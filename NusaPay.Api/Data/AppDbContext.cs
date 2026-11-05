using Microsoft.EntityFrameworkCore;
using NusaPay.Api.Models;

namespace NusaPay.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<WalletTransaction> Transactions => Set<WalletTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(100).IsRequired();
            e.Property(x => x.Email).HasMaxLength(150).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(255).IsRequired();
            e.Property(x => x.Role).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Wallet>(e =>
        {
            e.Property(x => x.AccountNumber).HasMaxLength(20).IsRequired();
            e.Property(x => x.Balance).HasPrecision(18, 2);
            e.HasIndex(x => x.AccountNumber).IsUnique();

            e.HasOne(x => x.User)
             .WithOne(u => u.Wallet)
             .HasForeignKey<Wallet>(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Pengaman terakhir di level database: saldo tidak boleh minus
            e.ToTable(t => t.HasCheckConstraint("CK_Wallets_Balance_NonNegative", "`Balance` >= 0"));
        });

        modelBuilder.Entity<WalletTransaction>(e =>
        {
            e.Property(x => x.Reference).HasMaxLength(40).IsRequired();
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Note).HasMaxLength(200);
            e.Property(x => x.IdempotencyKey).HasMaxLength(64);

            e.HasIndex(x => x.Reference).IsUnique();
            e.HasIndex(x => x.CreatedAt);
            // Satu user tidak bisa memakai Idempotency-Key yang sama dua kali
            e.HasIndex(x => new { x.InitiatedByUserId, x.IdempotencyKey }).IsUnique();

            e.HasOne(x => x.FromWallet).WithMany()
             .HasForeignKey(x => x.FromWalletId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ToWallet).WithMany()
             .HasForeignKey(x => x.ToWalletId).OnDelete(DeleteBehavior.Restrict);

            e.ToTable(t => t.HasCheckConstraint("CK_Transactions_Amount_Positive", "`Amount` > 0"));
        });
    }
}