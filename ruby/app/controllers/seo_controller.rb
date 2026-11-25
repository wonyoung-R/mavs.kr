require "nokogiri"
class SeoController < ApplicationController
  KINDS = %w[pages games players seasons articles].freeze

  def robots
    set_public_cache(3600)
    render plain: "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /auth/\nDisallow: /login\nDisallow: /profile\nDisallow: /community/new\nDisallow: /column/new\nDisallow: /analysis/new\nSitemap: #{helpers.site_url('/sitemap.xml')}\n", content_type: "text/plain"
  end

  def index
    set_public_cache(3600)
    xml = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |builder|
      builder.sitemapindex(xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9") do
        KINDS.each { |kind| builder.sitemap { builder.loc helpers.site_url("/sitemaps/#{kind}.xml") } }
      end
    end
    render xml: xml.to_xml
  end

  def sitemap
    kind = string_param(:kind)
    return not_found unless KINDS.include?(kind)
    data = repository.index unless %w[pages articles].include?(kind)
    entries = case kind
    when "pages"
      %w[/ /players /records /history /data].map { |path| { path: path, bilingual: true } } + %w[/news /comm /column /analysis].map { |path| { path: path } }
    when "games" then data.fetch("games").map { |game| { path: "/games/#{ERB::Util.url_encode(game['id'])}", bilingual: true } }
    when "players" then data.fetch("players").map { |player| { path: "/players/#{ERB::Util.url_encode(player['id'])}", bilingual: true } }
    when "seasons" then data.fetch("games").map { |game| [game["season"], game["competition"]] }.uniq.map { |season, competition| { path: "/seasons/#{season}/#{competition}", bilingual: true } }
    when "articles" then ContentRepository.new.index.map { |article| { path: "/#{article['kind']}/#{ERB::Util.url_encode(article['id'])}", modified: article["updated"].iso8601 } }
    end
    xml = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |builder|
      builder.urlset("xmlns" => "http://www.sitemaps.org/schemas/sitemap/0.9", "xmlns:xhtml" => "http://www.w3.org/1999/xhtml") do
        entries.each do |entry|
          ko = entry[:path]
          en = ko == "/" ? "/en" : "/en#{ko}"
          (entry[:bilingual] ? [ko, en] : [ko]).each do |path|
            builder.url do
              builder.loc helpers.site_url(path)
              builder.lastmod entry[:modified] if entry[:modified]
              if entry[:bilingual]
                { "ko" => ko, "en" => en, "x-default" => ko }.each { |lang, target| builder["xhtml"].link(rel: "alternate", hreflang: lang, href: helpers.site_url(target)) }
              end
            end
          end
        end
      end
    end
    set_public_cache(3600)
    render xml: xml.to_xml
  end
end
