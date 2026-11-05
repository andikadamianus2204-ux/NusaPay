namespace NusaPay.Api.Models;

public class Wallet
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string AccountNumber { get; set; } = string.Empty; // nomor dompet, unik
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}