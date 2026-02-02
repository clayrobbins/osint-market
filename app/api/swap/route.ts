import { NextRequest, NextResponse } from "next/server";
import {
  getSwapQuote,
  executeSwap,
  getTokenPrices,
} from "@/lib/integrations/agentdex";

// ---------------------------------------------------------------------------
// GET /api/swap?action=quote | action=price
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action") ?? "quote";

  try {
    // --- Quote -----------------------------------------------------------
    if (action === "quote") {
      const inputMint = searchParams.get("inputMint");
      const outputMint = searchParams.get("outputMint");
      const amount = searchParams.get("amount");
      const slippage = searchParams.get("slippageBps");

      if (!inputMint || !outputMint || !amount) {
        return NextResponse.json(
          {
            error: "Missing required query params: inputMint, outputMint, amount",
          },
          { status: 400 }
        );
      }

      const quote = await getSwapQuote(
        inputMint,
        outputMint,
        amount,
        slippage ? Number(slippage) : undefined
      );

      return NextResponse.json(quote);
    }

    // --- Price -----------------------------------------------------------
    if (action === "price") {
      const mints = searchParams.get("mints");
      if (!mints) {
        return NextResponse.json(
          { error: "Missing required query param: mints (comma-separated)" },
          { status: 400 }
        );
      }

      const prices = await getTokenPrices(...mints.split(","));
      return NextResponse.json({ prices });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/swap  —  Execute a swap (requires auth)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // Require AgentDEX API key forwarded from the client / calling agent
    const authHeader = req.headers.get("authorization") ?? "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing Authorization header. Provide your AgentDEX API key as Bearer token.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { inputMint, outputMint, amount, slippageBps } = body;

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        {
          error: "Missing required fields: inputMint, outputMint, amount",
        },
        { status: 400 }
      );
    }

    const result = await executeSwap(
      apiKey,
      inputMint,
      outputMint,
      String(amount),
      slippageBps ?? 50
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Swap execution failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
