interface ReviewEmailData {
  companyName: string;
  reviewerName: string;
  rating: number;
  dashboardUrl: string;
}

export function buildReviewNotificationEmail(data: ReviewEmailData): string {
  const stars = "★".repeat(data.rating) + "☆".repeat(5 - data.rating);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Review — MMC Build</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#451A03;padding:24px 32px;">
            <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:600;">MMC Direct</h1>
            <p style="margin:4px 0 0;color:#FBBF24;font-size:13px;">New Review Received</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">
              Hi ${escapeHtml(data.companyName)},
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">
              <strong>${escapeHtml(data.reviewerName)}</strong> has left a review on your MMC Direct profile.
            </p>

            <!-- Rating -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <p style="margin:0;font-size:32px;color:#D97706;letter-spacing:4px;">${stars}</p>
                  <p style="margin:8px 0 0;color:#6B7280;font-size:14px;">${data.rating} out of 5 stars</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${escapeHtml(data.dashboardUrl)}"
                     style="display:inline-block;padding:14px 32px;background:#D97706;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                    View Reviews
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;">
              Sent via MMC Build Trade Directory
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
