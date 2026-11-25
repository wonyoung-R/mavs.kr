class MediaController < ApplicationController
  def show
    key = "#{string_param(:bucket)}/#{string_param(:object)}"
    full, file = MediaArchive.file(key)
    return not_found unless full
    response.headers["Cache-Control"] = "public, max-age=86400"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "sandbox; default-src 'none'"
    type = file["contentType"].to_s.split(";").first
    inline = MediaArchive::SAFE_INLINE.include?(type)
    send_file full, type: inline ? type : "application/octet-stream", disposition: inline ? "inline" : "attachment"
  end
end
