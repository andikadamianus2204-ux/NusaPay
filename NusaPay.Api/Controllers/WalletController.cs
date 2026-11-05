using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NusaPay.Api.DTOs;
using NusaPay.Api.Services;

namespace NusaPay.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/wallet")]
public class WalletController : ControllerBase
{
    private readonly WalletService _wallet;

    public WalletController(WalletService wallet)
    {
        _wallet = wallet;
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<WalletDto>> Get()
        => Ok(await _wallet.GetWalletAsync(UserId));

    [HttpGet("lookup/{accountNumber}")]
    public async Task<ActionResult<LookupDto>> Lookup(string accountNumber)
        => Ok(await _wallet.LookupAsync(accountNumber));

    [HttpPost("topup")]
    public async Task<ActionResult<TransactionDto>> TopUp(
        TopUpRequest request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
        => Ok(await _wallet.TopUpAsync(UserId, request, idempotencyKey));

    [HttpPost("transfer")]
    public async Task<ActionResult<TransactionDto>> Transfer(
        TransferRequest request, [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
        => Ok(await _wallet.TransferAsync(UserId, request, idempotencyKey));
}