using Microsoft.EntityFrameworkCore;
using NusaPay.Api.Data;
using NusaPay.Api.DTOs;
using NusaPay.Api.Exceptions;
using NusaPay.Api.Models;

namespace NusaPay.Api.Services;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;

    public AuthService(AppDbContext db, TokenService tokens)
    {
        _db = db;
        _tokens = tokens;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            throw new AppException("Email sudah terdaftar.", StatusCodes.Status409Conflict);

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "User",
            // User dan Wallet disimpan dalam satu SaveChanges (satu transaksi database)
            Wallet = new Wallet { AccountNumber = await GenerateAccountNumberAsync(), Balance = 0 }
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return BuildResponse(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.Include(u => u.Wallet).FirstOrDefaultAsync(u => u.Email == email);

        // Pesan sengaja dibuat sama agar tidak membocorkan apakah email terdaftar
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new AppException("Email atau password salah.", StatusCodes.Status401Unauthorized);

        return BuildResponse(user);
    }

    public async Task<UserDto> GetProfileAsync(int userId)
    {
        var user = await _db.Users.Include(u => u.Wallet).FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new AppException("User tidak ditemukan.", StatusCodes.Status404NotFound);

        return ToDto(user);
    }

    private AuthResponse BuildResponse(User user)
    {
        var (token, expires) = _tokens.CreateToken(user);
        return new AuthResponse { Token = token, ExpiresAt = expires, User = ToDto(user) };
    }

    private static UserDto ToDto(User user) => new()
    {
        Id = user.Id,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role,
        AccountNumber = user.Wallet?.AccountNumber ?? string.Empty,
        Balance = user.Wallet?.Balance ?? 0
    };

    private async Task<string> GenerateAccountNumberAsync()
    {
        while (true)
        {
            var number = Random.Shared.NextInt64(1_000_000_000, 10_000_000_000).ToString();
            if (!await _db.Wallets.AnyAsync(w => w.AccountNumber == number))
                return number;
        }
    }
}