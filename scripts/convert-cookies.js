const fs = require('fs');
const path = require('path');

const SAME_SITE_MAP = {
  'unspecified': 'None',
  'no_restriction': 'None',
  'lax': 'Lax',
  'strict': 'Strict',
};

function convertCookies(sourcePath, destPath) {
  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

  const converted = raw.map(cookie => {
    const pw = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure || false,
      httpOnly: cookie.httpOnly || false,
      sameSite: SAME_SITE_MAP[cookie.sameSite] || 'None',
    };

    if (cookie.expirationDate) {
      pw.expires = Math.floor(cookie.expirationDate);
    }

    return pw;
  });

  fs.writeFileSync(destPath, JSON.stringify(converted, null, 2));
  console.log(`Converted ${converted.length} cookies to Playwright format`);

  // Warn about session cookie expiry
  const sessionCookie = converted.find(c => c.name === 'sessionid');
  if (sessionCookie && sessionCookie.expires) {
    const expiresDate = new Date(sessionCookie.expires * 1000);
    const hoursLeft = (expiresDate - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < 48) {
      console.log(`WARNING: sessionid cookie expires in ${hoursLeft.toFixed(1)} hours (${expiresDate.toISOString()})`);
    } else {
      console.log(`sessionid expires: ${expiresDate.toISOString()}`);
    }
  }

  return converted;
}

// CLI usage
if (require.main === module) {
  const rootDir = path.join(__dirname, '..');
  const destPath = process.argv[3] || path.join(rootDir, 'cookies.json');

  // Auto-detect source: explicit arg → raw GetCookies file in project root
  let sourcePath = process.argv[2];
  if (!sourcePath) {
    const rawInRoot = path.join(rootDir, 'www.tradingview.com_cookies.json');
    if (fs.existsSync(rawInRoot)) {
      sourcePath = rawInRoot;
    }
  }

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.error('No cookie file found.');
    console.error('Either drop www.tradingview.com_cookies.json in the project root,');
    console.error('or run: node convert-cookies.js <path-to-getcookies-export>');
    process.exit(1);
  }

  convertCookies(sourcePath, destPath);
  console.log(`Output: ${destPath}`);
}

module.exports = { convertCookies };
