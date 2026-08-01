# VIDSLOOM Google OAuth Verification Submission

Project: `business-heroes-infinity`
App name: `VIDSLOOM`
Production site: `https://vidsloom.com`
Privacy policy: `https://vidsloom.com/privacy`
Terms: `https://vidsloom.com/terms`
Demo video: `https://youtu.be/lzBbxcgUmSo`
Submission status: submitted to Google OAuth verification on June 16, 2026; Google Console shows the app's data access is under review.

## Scope Justification: YouTube Upload

Scope: `https://www.googleapis.com/auth/youtube.upload`

VIDSLOOM uses this scope only after a customer explicitly connects their YouTube channel and approves auto-posting rules. The scope lets VIDSLOOM upload the customer-approved generated MP4 campaign asset as a YouTube Short to the customer's own channel. VIDSLOOM does not use this scope to delete videos, modify unrelated content, or access passwords. A narrower YouTube upload-only scope is required because VIDSLOOM must post the approved video file directly rather than requiring the customer to manually upload every asset.

Demo video: `https://youtu.be/lzBbxcgUmSo`

## Scope Justification: YouTube Read-Only

Scope: `https://www.googleapis.com/auth/youtube.readonly`

VIDSLOOM uses read-only access to verify the uploaded Short's channel-side status, privacy/upload status, and basic post metrics such as views, likes, and comments for the customer's campaign proof report. VIDSLOOM does not use this scope to alter channel content. A read-only scope is required because the app must show customers whether an approved upload was processed and what early performance metrics were recorded.

Demo video: `https://youtu.be/lzBbxcgUmSo`

## Additional Info

VIDSLOOM is an AI-powered short-form video marketing engine for businesses. Customers create a campaign brief, review generated video assets, captions, schedules, and approval rules, then optionally connect YouTube Shorts through OAuth for direct posting. The demo video shows the customer-facing workflow, YouTube connection area, why upload access is needed, and how read-only status/metrics are returned to the customer proof report.

Production site: `https://vidsloom.com`
Privacy policy: `https://vidsloom.com/privacy`
Terms of service: `https://vidsloom.com/terms`
Demo video: `https://youtu.be/lzBbxcgUmSo`

Test access can be provided on request; the current production workflow uses customer portal links for onboarding and internal QA credentials for workspace review.

## Console Steps

1. Open `https://console.cloud.google.com/auth/scopes?project=business-heroes-infinity`.
2. Edit the sensitive YouTube scope details.
3. Add the matching scope justification and demo video URL above for each requested YouTube scope.
4. Save Data Access.
5. Open `https://console.cloud.google.com/auth/verification/submit?project=business-heroes-infinity`.
6. Paste the Additional Info text above.
7. Confirm and submit verification.
