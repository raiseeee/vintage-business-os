export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchQuery {
  text: string;
}

export interface WebSearchProvider {
  readonly name: string;
  search(query: WebSearchQuery): Promise<WebSearchResult[]>;
}
