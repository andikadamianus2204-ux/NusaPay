using System.Data;
using Microsoft.EntityFrameworkCore;
using NusaPay.Api.Data;
using NusaPay.Api.DTOs;
using NusaPay.Api.Exceptions;
using NusaPay.Api.Models;

namespace NusaPay.Api.Services;

public class WalletService
{
    private readonly AppDbContext _db;

    // Top up bersifat simulasi, jadi dibatasi per hari (hari dihitung dalam WIB)
    private const decimal DailyTopUpLimit = 5_000_000m;

    public WalletService(AppDbContext db)
    {
        _db = db;
    }

    // ---------- Baca ----------

    public async Task<WalletDto> GetWalletAsync(int userId)
    {
        var w = await _db.Wallets.AsNoTracking().Include(x => x.User)
            .FirstOrDefaultAsync(x => x.UserId == userId)
            ?? throw new AppException("Dompet tidak ditemukan.", StatusCodes.Status404NotFound);

        return new WalletDto { OwnerName = w.User.FullName, AccountNumber = w.AccountNumber, Balance = w.Balance };
    }

    public async Task<LookupDto> LookupAsync(string accountNumber)
    {
        var w = await _db.Wallets.AsNoTracking().Include(x => x.User)
            .FirstOrDefaultAsync(x => x.AccountNumber == accountNumber.Trim())
            ?? throw new AppException("Nomor rekening tidak ditemukan.", StatusCodes.Status404NotFound);

        return new LookupDto { OwnerName = w.User.FullName, AccountNumber = w.AccountNumber };
    }

    // direction: "in" (uang masuk), "out" (uang keluar), atau kosong (semua)
    public async Task<PagedResult<TransactionDto>> GetHistoryAsync(
        int userId, int page, int pageSize, string? direction = null)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var walletId = await GetWalletIdAsync(userId);

        var query = _db.Transactions.AsNoTracking();
        query = direction?.Trim().ToLowerInvariant() switch
        {
            "in"  => query.Where(t => t.ToWalletId == walletId),
            "out" => query.Where(t => t.FromWalletId == walletId),
            _     => query.Where(t => t.FromWalletId == walletId || t.ToWalletId == walletId)
        };

        var total = await query.CountAsync();
        var rows = await query
            .Include(t => t.FromWallet).ThenInclude(w => w!.User)
            .Include(t => t.ToWallet).ThenInclude(w => w!.User)
            .OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        return new PagedResult<TransactionDto>
        {
            Items = rows.Select(t => Map(t, walletId)).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<SummaryDto> GetSummaryAsync(int userId, int days = 7)
    {
        days = Math.Clamp(days, 1, 31);
        var walletId = await GetWalletIdAsync(userId);

        var wib = TimeSpan.FromHours(7);
        var today = (DateTime.UtcNow + wib).Date;
        var startLocal = today.AddDays(-(days - 1));
        var startUtc = startLocal - wib;

        var rows = await _db.Transactions.AsNoTracking()
            .Where(t => t.CreatedAt >= startUtc && (t.FromWalletId == walletId || t.ToWalletId == walletId))
            .Select(t => new { t.FromWalletId, t.ToWalletId, t.Amount, t.CreatedAt })
            .ToListAsync();

        var result = new SummaryDto();
        for (var i = 0; i < days; i++)
        {
            var day = startLocal.AddDays(i);
            var inDay = rows.Where(r => (r.CreatedAt + wib).Date == day).ToList();
            var income = inDay.Where(r => r.ToWalletId == walletId).Sum(r => r.Amount);
            var expense = inDay.Where(r => r.FromWalletId == walletId).Sum(r => r.Amount);
            result.Days.Add(new DailySummary { Date = day.ToString("yyyy-MM-dd"), Income = income, Expense = expense });
        }
        result.TotalIncome = result.Days.Sum(d => d.Income);
        result.TotalExpense = result.Days.Sum(d => d.Expense);
        return result;
    }

    // ---------- Tulis ----------

    public async Task<TransactionDto> TopUpAsync(int userId, TopUpRequest request, string? idempotencyKey)
    {
        ValidateAmount(request.Amount);
        var walletId = await GetWalletIdAsync(userId);

        var existing = await FindByKeyAsync(userId, idempotencyKey);
        if (existing is not null) return await GetDtoAsync(existing.Value, walletId);

        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

        var wallets = await LockWalletsAsync(walletId, walletId);

        // Batas top up harian. Dicek SETELAH baris dompet dikunci, jadi dua top up bersamaan tidak bisa lolos bersama.
        var wib = TimeSpan.FromHours(7);
        var startUtc = (DateTime.UtcNow + wib).Date - wib;
        var todayTotal = await _db.Transactions
            .Where(t => t.ToWalletId == walletId && t.Type == TransactionType.TopUp && t.CreatedAt >= startUtc)
            .SumAsync(t => (decimal?)t.Amount) ?? 0;

        if (todayTotal + request.Amount > DailyTopUpLimit)
            throw new AppException(
                $"Batas top up harian Rp{DailyTopUpLimit:N0} terlampaui. Sisa batas hari ini: Rp{Math.Max(0, DailyTopUpLimit - todayTotal):N0}.");

        wallets[walletId].Balance += request.Amount;

        var trx = new WalletTransaction
        {
            Reference = NewReference(),
            Type = TransactionType.TopUp,
            Amount = request.Amount,
            Note = "Top up saldo",
            ToWalletId = walletId,
            InitiatedByUserId = userId,
            IdempotencyKey = NormalizeKey(idempotencyKey)
        };
        _db.Transactions.Add(trx);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return await GetDtoAsync(trx.Id, walletId);
    }

    public async Task<TransactionDto> TransferAsync(int userId, TransferRequest request, string? idempotencyKey)
    {
        ValidateAmount(request.Amount);
        var fromId = await GetWalletIdAsync(userId);

        var existing = await FindByKeyAsync(userId, idempotencyKey);
        if (existing is not null) return await GetDtoAsync(existing.Value, fromId);

        var toAccount = request.ToAccountNumber.Trim();
        var toId = await _db.Wallets.AsNoTracking()
            .Where(w => w.AccountNumber == toAccount)
            .Select(w => (int?)w.Id).FirstOrDefaultAsync()
            ?? throw new AppException("Nomor rekening tujuan tidak ditemukan.", StatusCodes.Status404NotFound);

        if (toId == fromId)
            throw new AppException("Tidak bisa transfer ke rekening sendiri.");

        // Satu transaksi database: kalau ada yang gagal, semuanya dibatalkan.
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

        var wallets = await LockWalletsAsync(fromId, toId);
        var sender = wallets[fromId];
        var receiver = wallets[toId];

        // Saldo dicek SETELAH baris dikunci, jadi dua transfer bersamaan tidak bisa membuat saldo minus
        if (sender.Balance < request.Amount)
            throw new AppException("Saldo tidak cukup.");

        sender.Balance -= request.Amount;
        receiver.Balance += request.Amount;

        var trx = new WalletTransaction
        {
            Reference = NewReference(),
            Type = TransactionType.Transfer,
            Amount = request.Amount,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            FromWalletId = fromId,
            ToWalletId = toId,
            InitiatedByUserId = userId,
            IdempotencyKey = NormalizeKey(idempotencyKey)
        };
        _db.Transactions.Add(trx);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return await GetDtoAsync(trx.Id, fromId);
    }

    // ---------- Helper ----------

    private async Task<int> GetWalletIdAsync(int userId)
    {
        // Memakai projection (tidak ter-track) supaya saldo yang dibaca nanti selalu dari baris yang dikunci
        return await _db.Wallets.AsNoTracking()
            .Where(w => w.UserId == userId)
            .Select(w => (int?)w.Id).FirstOrDefaultAsync()
            ?? throw new AppException("Dompet tidak ditemukan.", StatusCodes.Status404NotFound);
    }

    // SELECT ... FOR UPDATE: mengunci baris dompet sampai transaksi selesai.
    // ORDER BY Id membuat urutan kunci selalu sama, sehingga tidak terjadi deadlock saat A->B dan B->A bersamaan.
    private async Task<Dictionary<int, Wallet>> LockWalletsAsync(int a, int b)
    {
        var list = await _db.Wallets
            .FromSqlInterpolated($"SELECT * FROM Wallets WHERE Id = {a} OR Id = {b} ORDER BY Id FOR UPDATE")
            .ToListAsync();
        return list.ToDictionary(w => w.Id);
    }

    private async Task<long?> FindByKeyAsync(int userId, string? key)
    {
        key = NormalizeKey(key);
        if (key is null) return null;
        return await _db.Transactions.AsNoTracking()
            .Where(t => t.InitiatedByUserId == userId && t.IdempotencyKey == key)
            .Select(t => (long?)t.Id).FirstOrDefaultAsync();
    }

    private static string? NormalizeKey(string? key)
        => string.IsNullOrWhiteSpace(key) ? null : key.Trim()[..Math.Min(key.Trim().Length, 64)];

    private static void ValidateAmount(decimal amount)
    {
        if (amount <= 0)
            throw new AppException("Nominal harus lebih dari 0.");
        if (decimal.Round(amount, 2) != amount)
            throw new AppException("Nominal maksimal 2 angka di belakang koma.");
    }

    private static string NewReference()
        => $"TRX-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";

    private async Task<TransactionDto> GetDtoAsync(long id, int viewerWalletId)
    {
        var t = await _db.Transactions.AsNoTracking()
            .Include(x => x.FromWallet).ThenInclude(w => w!.User)
            .Include(x => x.ToWallet).ThenInclude(w => w!.User)
            .FirstAsync(x => x.Id == id);
        return Map(t, viewerWalletId);
    }

    private static TransactionDto Map(WalletTransaction t, int viewerWalletId)
    {
        var isOut = t.Type == TransactionType.Transfer && t.FromWalletId == viewerWalletId;
        var other = isOut ? t.ToWallet : t.FromWallet; // top up: tidak ada lawan transaksi

        return new TransactionDto
        {
            Id = t.Id,
            Reference = t.Reference,
            Type = t.Type.ToString(),
            Direction = isOut ? "Out" : "In",
            Amount = t.Amount,
            Note = t.Note,
            CounterpartyName = other?.User.FullName,
            CounterpartyAccount = other?.AccountNumber,
            CreatedAt = DateTime.SpecifyKind(t.CreatedAt, DateTimeKind.Utc)
        };
    }
}