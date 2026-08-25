UPDATE templates
SET
  subject_template = replace(
    replace(
      replace(subject_template, '\r\n', char(10)),
      '\n',
      char(10)
    ),
    '\r',
    char(10)
  ),
  html_template = replace(
    replace(
      replace(html_template, '\r\n', char(10)),
      '\n',
      char(10)
    ),
    '\r',
    char(10)
  ),
  text_template = CASE
    WHEN text_template IS NULL THEN NULL
    ELSE replace(
      replace(
        replace(text_template, '\r\n', char(10)),
        '\n',
        char(10)
      ),
      '\r',
      char(10)
    )
  END,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
  instr(subject_template, '\n') > 0
  OR instr(subject_template, '\r') > 0
  OR instr(html_template, '\n') > 0
  OR instr(html_template, '\r') > 0
  OR instr(coalesce(text_template, ''), '\n') > 0
  OR instr(coalesce(text_template, ''), '\r') > 0;
