using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NusaPay.Api.DTOs;
using NusaPay.Api.Services;

namespace NusaPay.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/transactions")]
public class TransactionsController : ControllerBase
{
    private readonly WalletService _wallet;

    public TransactionsController(WalletService wallet)
    {
        _wallet = wallet;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // direction: "in" (uang masuk), "out" (uang keluar), atau kosong (semua)
    [HttpGet]
    public async Task<ActionResult<PagedResult<TransactionDto>>> History(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? direction = null)
        => Ok(await _wallet.GetHistoryAsync(UserId, page, pageSize, direction));

    [HttpGet("summary")]
    public async Task<ActionResult<SummaryDto>> Summary([FromQuery] int days = 7)
        => Ok(await _wallet.GetSummaryAsync(UserId, days));
}