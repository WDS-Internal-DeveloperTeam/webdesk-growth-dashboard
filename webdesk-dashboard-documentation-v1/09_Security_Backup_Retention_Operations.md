# Security, Backup, Retention, and Operations

## 1. Security principles

- deny by default;
- least privilege;
- separation of duties;
- server-side authorization;
- secure defaults;
- no secrets in records or logs;
- immutable audit events for high-risk actions;
- no automatic production repair or deletion.

## 2. Required controls

- threat modelling before production;
- rate limiting through Upstash Redis;
- login-attempt limiting and account lockout;
- SSO MFA and local-admin TOTP;
- two-person local-account recovery;
- dependency and vulnerability scanning;
- secure headers and CSRF protection where applicable;
- webhook signature verification;
- file type/size validation;
- encrypted transport;
- environment isolation;
- incident-response ownership.

## 3. Upload security

Malware provider is deferred.

Until configured:

- authenticated internal users only;
- blocked file types remain blocked;
- server-verified MIME and extension;
- checksum recorded;
- file status may be `Scan Not Configured`;
- the system must not state that the file is malware-free;
- administrators may disable upload categories.

## 4. Backup policy

### Database

- encrypted logical PostgreSQL export daily;
- North America East Coast backup location;
- checksum verification;
- daily retention: 35 days;
- monthly retention: 1 year;
- quarterly restore test on staging.

### Blob

- copy Vercel Blob files daily to independent encrypted East Coast object storage;
- verify with checksums;
- daily versions: 35 days;
- monthly copies: 90 days unless superseded by a later approved policy.

### WordPress

- daily WordPress.com backup;
- pre-production-deployment backup;
- monthly off-platform encrypted backup for one year;
- quarterly staging restore test.

## 5. Recovery targets

### Production

- RPO target: 15 minutes where supported by the operational provider and approved recovery design;
- manual logical exports provide independent protection but do not by themselves satisfy a 15-minute RPO;
- RTO: 4 hours.

### Staging

- RPO: 24 hours;
- RTO: 8 hours.

Implementation must document the actual achieved RPO before launch.

## 6. Retention matrix

| Category                           |                                                     Retention |
| ---------------------------------- | ------------------------------------------------------------: |
| Active sessions                    |                               Until logout/expiry, max 7 days |
| Expired session records            |                                                       30 days |
| Authentication logs                |                                                       30 days |
| General application logs           |                                                       90 days |
| Sentry error records               |                                                       90 days |
| Audit records                      |                                                       7 years |
| Approval history operational view  |                                                        1 year |
| Immutable approval audit events    |                                                       7 years |
| Notification history               |                                                       30 days |
| Completed jobs                     |                                                       30 days |
| Failed jobs                        |                                                      120 days |
| Scan reports                       |                                                       90 days |
| Scan evidence/screenshots          |                                                        1 year |
| Security logs                      |                                                        1 year |
| Closed security findings/incidents |                                                       3 years |
| Malware findings/review decisions  |                3 years after closure when scanning is enabled |
| Clean uploads                      | While active, then 90 days after closure/deletion/replacement |
| Rejected/infected uploads          |                    30-day quarantine, then permanent deletion |
| Import files                       |                                                        7 days |
| Export files                       |                                                        7 days |
| Soft-deleted records               |                                                       30 days |
| Daily database backups             |                                                       35 days |
| Monthly database backups           |                                                        1 year |
| Daily Blob backups                 |                                                       35 days |
| Monthly Blob backups               |                                                       90 days |
| SMTP/webhook delivery events       |                                                       30 days |
| Deployment logs                    |                                                       30 days |
| Deployment approvals/audit events  |                                                       7 years |

## 7. Retention deletion job

A scheduled Vercel Cron Job starts the retention workflow.

Every deletion run records:

- run ID;
- environment;
- data category;
- retention-rule version;
- cutoff date;
- records/files examined;
- records/files deleted;
- start/end time;
- result;
- failure details;
- application commit SHA.

Legal holds, active investigations, contracts, and litigation holds override deletion.

## 8. Monitoring ownership

Configurable operational areas:

- Dashboard
- WordPress
- DevOps
- Security
- Project Management
- Database
- Backups
- GitHub
- Email notifications

Each area supports:

- one primary owner;
- multiple backup owners;
- multiple email addresses;
- multiple emergency contacts;
- escalation order;
- working hours/time zone;
- after-hours availability;
- vendor-support authority;
- effective date and last confirmation.

## 9. Incident response targets

| Severity | Initial response target |
| -------- | ----------------------: |
| Critical |              15 minutes |
| High     |                  1 hour |
| Medium   |        One business day |
| Low      |   Scheduled maintenance |

These targets are configurable and separate from resolution targets.

## 10. Security finding release rule

An unresolved critical finding blocks production unless:

- an authorized exception is approved;
- reason and compensating control are recorded;
- exception has an expiry date;
- Security Owner accepts the risk;
- audit event is retained.
