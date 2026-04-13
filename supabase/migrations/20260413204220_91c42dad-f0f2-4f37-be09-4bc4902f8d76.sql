DROP TRIGGER IF EXISTS update_lagostina_top_keywords_updated_at ON public.lagostina_top_keywords;
CREATE TRIGGER update_lagostina_top_keywords_updated_at
BEFORE UPDATE ON public.lagostina_top_keywords
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();