CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_lines_path_index_uniq
ON public.bank_statement_lines (statement_path, line_index);