// Day-0 stub. The full vercel/chatbot structure lands in a follow-up ticket:
// - app/(chat)/page.tsx             the chat surface
// - app/api/chat/route.ts           streamText + AI Gateway
// - components/chat/message.tsx     message bubble (valibot schemas, no zod)
// - lib/ai/models.ts                per-model provider registry
// - lib/env.ts                      Valibot env parser (banned: process.env)
export default function Page(): React.JSX.Element {
  return (
    <main>
      <h1>chezy</h1>
      <p>Day-0 scaffold. Chat surface lands in the next ticket.</p>
    </main>
  );
}
