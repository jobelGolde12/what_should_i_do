Cannot send an email using mailgun and got this error: [taskmind] {"t":"2026-08-09T15:13:52.073Z","level":"info","scope":"auth","event":"login","ip":"::1","email":"jobelgolde44@gmail.com","outcome":"invalid_credentials"}
 POST /api/auth/login 401 in 3679ms
 ○ Compiling /auth/register ...
 ✓ Compiled /auth/register in 736ms (2391 modules)
 ✓ Compiled /manifest.webmanifest in 418ms (1485 modules)
 GET /manifest.webmanifest 200 in 593ms
 ○ Compiling /api/auth/register ...
 ✓ Compiled /api/auth/register in 660ms (1489 modules)
[taskmind] {"t":"2026-08-09T15:14:32.495Z","level":"warn","scope":"mail","status":404,"detail":"404 page not found\n","to":"jobelgolde43@gmail.com"}
[taskmind] {"t":"2026-08-09T15:14:32.496Z","level":"info","scope":"auth","event":"register","ip":"::1","email":"jobelgolde43@gmail.com","outcome":"created_mail_failed","sent":false}
 POST /api/auth/register 502 in 4336ms