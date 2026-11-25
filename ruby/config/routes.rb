Rails.application.routes.draw do
  get "/up", to: "health#show"
  get "/robots.txt", to: "seo#robots", defaults: { format: "text" }
  get "/sitemap.xml", to: "seo#index", defaults: { format: "xml" }
  get "/sitemaps/:kind.xml", to: "seo#sitemap", constraints: { kind: /pages|games|players|seasons|articles/ }, defaults: { format: "xml" }
  get "/api/records/:action", controller: "record_api", constraints: { action: /coverage|scope|query/ }
  post "/api/records/query", to: "record_api#query"
  get "/news", to: "content#index", defaults: { kind: "news" }
  get "/news/:id", to: "content#show", defaults: { kind: "news" }
  %w[comm column analysis].each do |kind|
    get "/#{kind}", to: "content#index", defaults: { kind: kind }
  end
  %w[community column analysis].each do |kind|
    get "/#{kind}/:id", to: "content#show", defaults: { kind: kind }, constraints: { id: /(?!new$|members$)[^\/]+/ }
  end
  get "/fan", to: "content#fan"
  get "/media/:bucket/*object", to: "media#show", format: false, constraints: { bucket: /[^\/]+/ }
  scope "(:locale)", locale: /en/ do
    root "records#show", defaults: { section: "home" }
    post "/search", to: "records#show", defaults: { section: "search" }
    %w[search seasons players records compare history data].each do |section|
      get "/#{section}", to: "records#show", defaults: { section: section }
    end
    get "/seasons/:season(/:competition)", to: "records#show", defaults: { section: "seasons" }, constraints: { season: /\d{4}/, competition: /regular|playoffs|playin|cup_final|preseason|summer/ }
    get "/games/:id", to: "records#show", defaults: { section: "game" }, format: false
    get "/players/:id", to: "records#show", defaults: { section: "player" }, format: false
  end
  # Authoring, auth, admin and ingestion retain their existing application.
  match "*path", to: "legacy#forward", via: [:get, :post, :patch, :put, :delete], format: false
end
