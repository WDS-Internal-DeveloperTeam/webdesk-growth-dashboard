# Roles and Permissions

## 1. Roles

1. Super Admin
2. Owner / Growth Approver
3. Marketing Editor
4. Designer / Creative Reviewer
5. Developer
6. QA / Security Reviewer
7. Read-Only

Permissions are deny-by-default and may be narrowed by project, module, action, record, or confidential field.

## 2. Action legend

- V: View
- C: Create
- E: Edit
- S: Submit
- R: Review
- A: Approve
- P: Publish/Unpublish
- L: Release/Rollback
- X: Export
- M: Manage configuration

## 3. High-level matrix

| Module/action          | Super Admin  | Owner/Growth         | Marketing            | Designer             | Developer            | QA/Security          | Read-Only    |
| ---------------------- | ------------ | -------------------- | -------------------- | -------------------- | -------------------- | -------------------- | ------------ |
| Project configuration  | VCEAM        | VEA                  | V                    | V                    | V                    | V                    | V            |
| Business Knowledge     | VCERAMX      | VCERAX               | VCES                 | V                    | V                    | V                    | V            |
| Website Strategy       | VCERAMX      | VCERAX               | VCESR                | VCR                  | V                    | VR                   | V            |
| Page Inventory         | VCERAMX      | VCERAX               | VCES                 | V                    | VCE                  | VR                   | V            |
| Page content           | VCERAPX      | VCERAPX              | VCESR                | VR                   | V                    | VR                   | V            |
| Creative/design        | VCERAPX      | VERAPX               | VR                   | VCERAS               | V                    | VR                   | V            |
| Development/code       | VCERL        | VRL                  | V                    | V                    | VCES                 | VRA                  | V            |
| Security/QA            | VCERAL       | VRL                  | V                    | V                    | VR                   | VCERAS               | V            |
| Case studies           | VCERAPX      | VCERAPX              | VCESR                | VR                   | V                    | VR                   | V            |
| Portfolio              | VCERAPX      | VCERAPX              | VCESR                | VR                   | V                    | VR                   | V            |
| Service/persona/proof  | VCERAMX      | VCERAX               | VCESR                | V                    | V                    | VR                   | V            |
| Keyword/internal links | VCERAMX      | VCERAX               | VCESR                | V                    | V                    | VR                   | V            |
| Ready for Claude       | VCERAM       | VCERAM               | VCSE                 | VCSE                 | VCSE                 | VCSE                 | V            |
| Review Center          | VCERA        | VCERA                | VRA assigned         | VRA assigned         | VRA assigned         | VRA assigned         | V            |
| Scans                  | VCERM        | VCR                  | VR                   | V                    | VCER                 | VCER                 | V            |
| Change Center          | VCERA        | VCERA                | VRA assigned         | VRA assigned         | VRA assigned         | VRA assigned         | V            |
| Imports                | VCERAX       | VCERAX               | VCSEX assigned       | VCSEX assigned       | VCSEX assigned       | VCSEX assigned       | V            |
| Exports                | VX           | VX subject to fields | VX subject to fields | VX subject to fields | VX subject to fields | VX subject to fields | V if allowed |
| Releases               | VCERAL       | VCRAL assigned       | V                    | V                    | VCESR                | VRA                  | V            |
| Users/roles            | VCERM        | VM limited           | No                   | No                   | No                   | No                   | No           |
| System settings        | VCERM        | VM assigned          | No                   | No                   | No                   | No                   | No           |
| Confidential fields    | Configurable | Configurable         | Denied by default    | Denied               | Denied               | Limited by need      | Denied       |

## 4. Separation of duties

- A developer cannot approve their own code review.
- A content author should not be the sole final approver of the same content.
- Production release requires an authorized approver separate from the implementer where practical.
- Security exceptions require Security Owner or Super Admin authority.
- Local emergency-admin recovery requires a second authorized administrator.

## 5. Field-level controls

The API must independently enforce:

- view confidential field;
- edit confidential field;
- export confidential field;
- send confidential field to Claude task package;
- include confidential field in Git artifact.

Default is denied.

## 6. Audit requirements

Audit events are required for:

- role and permission changes;
- confidential-field access changes;
- user activation/deactivation;
- approval authority changes;
- production release authority changes;
- emergency-account login and recovery.
