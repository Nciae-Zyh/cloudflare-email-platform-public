CREATE TABLE IF NOT EXISTS default_email_templates (
  template_key TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL
);

INSERT INTO default_email_templates (
  template_key,
  name,
  description,
  subject_template,
  html_template
)
VALUES
  (
    'email_verification_code',
    'Email verification code',
    'Send a one-time code to verify an email address.',
    'Verify your email address',
    '<div style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#111827;line-height:1.6"><p style="margin:0 0 12px;color:#4f46e5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Email verification</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25">Verify your email address</h1><p style="margin:0 0 16px">Hi {{user.name}},</p><p style="margin:0 0 20px">Enter the verification code below to confirm your email address.</p><div style="margin:24px 0;padding:20px;border-radius:12px;background:#eef2ff;color:#312e81;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;text-align:center">{{verification.code}}</div><p style="margin:0 0 16px;color:#475569">This code expires in {{verification.expires_minutes}} minutes. If you did not request this code, you can safely ignore this email.</p><p style="margin:28px 0 0;color:#94a3b8;font-size:12px">This is an automated transactional email.</p></div>'
  ),
  (
    'welcome_registration',
    'Welcome registration',
    'Welcome a user after successful registration.',
    'Welcome to {{app.name}}',
    '<div style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#111827;line-height:1.6"><p style="margin:0 0 12px;color:#4f46e5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Registration complete</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25">Welcome to {{app.name}}</h1><p style="margin:0 0 16px">Hi {{user.name}},</p><p style="margin:0 0 16px">Your account has been created successfully. You can now sign in and start using {{app.name}}.</p><p style="margin:0 0 8px;font-weight:700">Open your account:</p><p style="margin:0;padding:14px;border-radius:10px;background:#f8fafc;color:#334155;word-break:break-all">{{action.url}}</p><p style="margin:28px 0 0;color:#94a3b8;font-size:12px">This is an automated transactional email.</p></div>'
  ),
  (
    'sign_in_code',
    'Sign-in code',
    'Send a one-time code for passwordless sign-in.',
    'Your sign-in code',
    '<div style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#111827;line-height:1.6"><p style="margin:0 0 12px;color:#4f46e5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Secure sign-in</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25">Your sign-in code</h1><p style="margin:0 0 16px">Hi {{user.name}},</p><p style="margin:0 0 20px">Use the one-time code below to complete your sign-in.</p><div style="margin:24px 0;padding:20px;border-radius:12px;background:#eef2ff;color:#312e81;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;text-align:center">{{verification.code}}</div><p style="margin:0 0 16px;color:#475569">This code expires in {{verification.expires_minutes}} minutes. Never share this code with anyone.</p><p style="margin:28px 0 0;color:#94a3b8;font-size:12px">This is an automated transactional email.</p></div>'
  ),
  (
    'password_reset',
    'Password reset',
    'Send a secure password reset link.',
    'Reset your password',
    '<div style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#111827;line-height:1.6"><p style="margin:0 0 12px;color:#4f46e5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Password security</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25">Reset your password</h1><p style="margin:0 0 16px">Hi {{user.name}},</p><p style="margin:0 0 16px">A password reset was requested for your account. Open the secure link below to choose a new password.</p><p style="margin:0 0 8px;font-weight:700">Password reset link:</p><p style="margin:0;padding:14px;border-radius:10px;background:#f8fafc;color:#334155;word-break:break-all">{{action.url}}</p><p style="margin:16px 0 0;color:#475569">This link expires in {{security.expires_minutes}} minutes. If you did not request a password reset, you can safely ignore this email.</p><p style="margin:28px 0 0;color:#94a3b8;font-size:12px">This is an automated transactional email.</p></div>'
  ),
  (
    'password_changed',
    'Password changed',
    'Notify a user after the account password changes.',
    'Your password was changed',
    '<div style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#111827;line-height:1.6"><p style="margin:0 0 12px;color:#4f46e5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Security notice</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25">Your password was changed</h1><p style="margin:0 0 16px">Hi {{user.name}},</p><p style="margin:0 0 16px">The password for your account was changed successfully.</p><div style="margin:20px 0;padding:16px;border-radius:10px;background:#f8fafc;color:#334155"><p style="margin:0 0 6px"><strong>Time:</strong> {{security.changed_at}}</p><p style="margin:0"><strong>IP address:</strong> {{security.ip_address}}</p></div><p style="margin:0;color:#475569">If you did not make this change, contact your support team immediately and secure your account.</p><p style="margin:28px 0 0;color:#94a3b8;font-size:12px">This is an automated transactional email.</p></div>'
  ),
  (
    'account_invitation',
    'Account invitation',
    'Invite a user to create or join an account.',
    'You are invited to {{app.name}}',
    '<div style="max-width:600px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#111827;line-height:1.6"><p style="margin:0 0 12px;color:#4f46e5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Account invitation</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25">You are invited to {{app.name}}</h1><p style="margin:0 0 16px">Hi {{user.name}},</p><p style="margin:0 0 16px">{{inviter.name}} invited you to join {{app.name}}.</p><p style="margin:0 0 8px;font-weight:700">Accept the invitation:</p><p style="margin:0;padding:14px;border-radius:10px;background:#f8fafc;color:#334155;word-break:break-all">{{action.url}}</p><p style="margin:16px 0 0;color:#475569">If you were not expecting this invitation, you can safely ignore this email.</p><p style="margin:28px 0 0;color:#94a3b8;font-size:12px">This is an automated transactional email.</p></div>'
  );

UPDATE templates
SET
  template_key = 'welcome_registration',
  name = (SELECT name FROM default_email_templates WHERE template_key = 'welcome_registration'),
  description = (SELECT description FROM default_email_templates WHERE template_key = 'welcome_registration'),
  subject_template = (SELECT subject_template FROM default_email_templates WHERE template_key = 'welcome_registration'),
  content_mode = 'html',
  html_template = (SELECT html_template FROM default_email_templates WHERE template_key = 'welcome_registration'),
  text_template = NULL,
  status = 'active',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
  template_key = 'welcome'
  AND (name = '欢迎邮件' OR instr(subject_template, '欢迎') > 0)
  AND NOT EXISTS (
    SELECT 1
    FROM templates AS existing
    WHERE
      existing.domain_id = templates.domain_id
      AND existing.template_key = 'welcome_registration'
  );

UPDATE templates
SET
  name = 'Welcome email',
  description = 'Welcome a user after successful registration.',
  subject_template = (SELECT subject_template FROM default_email_templates WHERE template_key = 'welcome_registration'),
  content_mode = 'html',
  html_template = (SELECT html_template FROM default_email_templates WHERE template_key = 'welcome_registration'),
  text_template = NULL,
  status = 'active',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
  template_key = 'welcome'
  AND (name = '欢迎邮件' OR instr(subject_template, '欢迎') > 0);

INSERT INTO templates (
  id,
  domain_id,
  template_key,
  name,
  description,
  subject_template,
  content_mode,
  html_template,
  text_template,
  from_local,
  from_name,
  reply_to,
  status,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))),
  domains.id,
  defaults.template_key,
  defaults.name,
  defaults.description,
  defaults.subject_template,
  'html',
  defaults.html_template,
  NULL,
  NULL,
  NULL,
  NULL,
  'active',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM domains
CROSS JOIN default_email_templates AS defaults
WHERE domains.sending_enabled = 1
ON CONFLICT(domain_id, template_key) DO NOTHING;
