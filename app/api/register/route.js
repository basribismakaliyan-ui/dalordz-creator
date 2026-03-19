import { registerOneAccount } from '@/lib/registration';
import { getAdminConfig } from '@/lib/config-store';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const userConfig = await request.json();

  // Server-side merge: user values override admin defaults
  const adminConfig = getAdminConfig();
  const config = {
    proxy: userConfig.proxy || adminConfig.proxy || '',
    domain: userConfig.domain || adminConfig.domain || '',
    defaultPassword: userConfig.defaultPassword || adminConfig.defaultPassword || '',
    imapEmail: userConfig.email || adminConfig.email || '',
    imapPassword: userConfig.appPassword || adminConfig.appPassword || '',
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await registerOneAccount(
          config,
          (message) => {
            send({ type: 'log', message });
          }
        );

        send({ type: 'success', email: result.email, password: result.password });
      } catch (error) {
        send({ type: 'error', message: error.message || 'Registration failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
