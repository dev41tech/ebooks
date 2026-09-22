export async function GET() {
  return Response.json({ subscription: null, salesEnabled: false, mode: "closed_beta" });
}
export async function POST() {
  return Response.json({ error: "sales_disabled", message: "O beta é gratuito por convite. Não há cobrança ou assinatura ativa." }, { status: 409 });
}
