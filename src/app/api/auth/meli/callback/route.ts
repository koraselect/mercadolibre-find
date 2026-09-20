import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/meli/callback?code=XXXX
 * Intercambia el authorization code por access_token + refresh_token.
 * Muestra el resultado al usuario para que lo copie al .env.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return new NextResponse("Missing 'code' parameter", { status: 400 });
  }

  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;
  const redirectUri = process.env.MELI_REDIRECT_URI || "http://localhost:3000/api/auth/meli/callback";

  if (!clientId || !clientSecret) {
    return new NextResponse("Missing MELI_CLIENT_ID or MELI_CLIENT_SECRET in .env", { status: 500 });
  }

  try {
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await tokenRes.json();

    if (!data.access_token) {
      return new NextResponse(
        `<html><body><h1>Error obteniendo token</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const html = `
<!DOCTYPE html>
<html>
<head><title>Token Obtenido</title></head>
<body style="font-family: system-ui; max-width: 700px; margin: 40px auto; padding: 0 20px;">
  <h1>Token Obtenido Exitosamente</h1>
  <p>Copia estas lineas en tu archivo <code>.env</code>:</p>
  <pre style="background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 14px;">MELI_ACCESS_TOKEN=${data.access_token}
MELI_REFRESH_TOKEN=${data.refresh_token}
MELI_TOKEN_EXPIRES_IN=${data.expires_in}
MELI_USER_ID=${data.user_id || "N/A"}</pre>
  <p>Tambien puedes ejecutar este comando en la terminal:</p>
  <pre style="background: #1a1a1a; color: #0f0; padding: 16px; border-radius: 8px; font-size: 13px;">echo 'MELI_ACCESS_TOKEN=${data.access_token}' >> .env
echo 'MELI_REFRESH_TOKEN=${data.refresh_token}' >> .env</pre>
  <h2>Prueba rapida</h2>
  <p><a href="/" style="color: blue;">Volver al home</a></p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    return new NextResponse(`Error: ${err}`, { status: 500 });
  }
}
