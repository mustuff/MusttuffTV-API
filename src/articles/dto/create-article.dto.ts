export class CreateArticleDto {
  title: string;
  slug: string;
  summary?: string;
  content: string;
  breaking?: boolean;
  authorId: string;
  countryId?: string;
  categoryId?: string;
}
