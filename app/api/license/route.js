const SUPABASE_URL = 'https://vtdweovocghpprerpyvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHdlb3ZvY2docHByZXJweXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODIwMjgsImV4cCI6MjA2OTU1ODAyOH0.pqguonrvJPgVTKnmNsmlir5ZE5xs2DT-i83DtuQXNU4';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const licenseKey = searchParams.get('key');

  if (!licenseKey) {
    return Response.json({ valid: false, message: 'License key is required' }, { status: 400 });
  }

  try {
    // Check against DATA HWID table using the license key as hwid
    const url = `${SUPABASE_URL}/rest/v1/DATA%20HWID?hwid=eq.${encodeURIComponent(licenseKey)}&select=*`;
    const resp = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (resp.status !== 200) {
      return Response.json({
        valid: false,
        message: `❌ Error mengakses database: ${resp.status}`,
      });
    }

    const data = await resp.json();

    if (!data || data.length === 0) {
      return Response.json({
        valid: false,
        message: `❌ Lisensi tidak terdaftar dalam database.\n\n🔑 Key: ${licenseKey}\n\nSilakan hubungi admin untuk registrasi lisensi.`,
      });
    }

    const license = data[0];
    const nama = license.nama || 'N/A';
    const expiredDate = license.expired;
    const whatsapp = license.whatsapp || 'N/A';

    // Check if expired date is set
    if (expiredDate === null || expiredDate === undefined) {
      return Response.json({
        valid: false,
        message: `❌ Lisensi belum aktif!\n\n👤 Nama: ${nama}\n🔑 Key: ${licenseKey}\n📱 WhatsApp: ${whatsapp}\n\nStatus: PENDING\nAdmin belum mengatur tanggal expired.\nSilakan hubungi admin untuk aktivasi lisensi.`,
      });
    }

    // Check expiry
    try {
      const expiredDt = new Date(expiredDate);
      const currentDt = new Date();
      
      // Compare dates only (ignore time)
      const expiredDay = new Date(expiredDt.getFullYear(), expiredDt.getMonth(), expiredDt.getDate());
      const currentDay = new Date(currentDt.getFullYear(), currentDt.getMonth(), currentDt.getDate());

      if (currentDay > expiredDay) {
        return Response.json({
          valid: false,
          message: `❌ Lisensi sudah expired pada ${expiredDate}\n\n👤 Nama: ${nama}\n🔑 Key: ${licenseKey}\n📱 WhatsApp: ${whatsapp}\n\nSilakan hubungi admin untuk perpanjangan lisensi.`,
        });
      }
    } catch (e) {
      return Response.json({
        valid: false,
        message: `❌ Lisensi belum aktif!\n\n👤 Nama: ${nama}\n🔑 Key: ${licenseKey}\n📱 WhatsApp: ${whatsapp}\n\nStatus: PENDING\nFormat tanggal expired tidak valid.\nSilakan hubungi admin untuk aktivasi lisensi.`,
      });
    }

    // License is valid!
    return Response.json({
      valid: true,
      nama,
      expired: expiredDate,
      whatsapp,
      message: `✅ Lisensi Aktif!\n\n👤 Nama: ${nama}\n📅 Expired: ${expiredDate}\n📱 WhatsApp: ${whatsapp}\n🔑 Key: ${licenseKey}\n\nProgram siap digunakan!`,
    });

  } catch (e) {
    return Response.json({
      valid: false,
      message: `❌ Error mengecek lisensi: ${e.message}`,
    });
  }
}
