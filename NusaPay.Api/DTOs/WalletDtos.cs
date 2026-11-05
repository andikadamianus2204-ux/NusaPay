using System.ComponentModel.DataAnnotations;

namespace NusaPay.Api.DTOs;

public class TopUpRequest
{
    [Range(1000, 2_000_000)]
    public decimal Amount { get; set; }
}

public class TransferRequest
{
    [Required, StringLength(20, MinimumLength = 5)]
    public string ToAccountNumber { get; set; } = string.Empty;

    [Range(1000, 50_000_000)]
    public decimal Amount { get; set; }

    [StringLength(200)]
    public string? Note { get; set; }
}

public class WalletDto
{
    public string OwnerName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public decimal Balance { get; set; }
}

public class LookupDto
{
    public string OwnerName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
}

public class TransactionDto
{
    public long Id { get; set; }
    public string Reference { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;       // TopUp / Transfer
    public string Direction { get; set; } = string.Empty;  // In / Out
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public string? CounterpartyName { get; set; }
    public string? CounterpartyAccount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

public class DailySummary
{
    public string Date { get; set; } = string.Empty; // yyyy-MM-dd (WIB)
    public decimal Income { get; set; }
    public decimal Expense { get; set; }
}

public class SummaryDto
{
    public List<DailySummary> Days { get; set; } = new();
    public decimal TotalIncome { get; set; }
    public decimal TotalExpense { get; set; }
}