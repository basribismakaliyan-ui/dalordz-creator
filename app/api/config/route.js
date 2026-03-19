import { getAdminConfig, setAdminConfig } from '@/lib/config-store';

export async function GET() {
  const config = getAdminConfig();
  return Response.json(config);
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Verify admin key
    if (body.adminKey !== '@Dalordz1') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove adminKey before saving
    const { adminKey, ...configData } = body;
    const updated = setAdminConfig(configData);
    return Response.json({ success: true, config: updated });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
