namespace NusaPay.Api.Models;

public enum TransactionType
{
    TopUp = 1,
    Transfer = 2
}

public class WalletTransaction
{
    public long Id { get; set; }
    public string Reference { get; set; } = string.Empty; // contoh: TRX-20261105-AB12CD34
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }

    public int? FromWalletId { get; set; }   // kosong untuk top up
    public Wallet? FromWallet { get; set; }
    public int? ToWalletId { get; set; }
    public Wallet? ToWallet { get; set; }

    public int InitiatedByUserId { get; set; }
    public string? IdempotencyKey { get; set; } // mencegah transaksi ganda
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}