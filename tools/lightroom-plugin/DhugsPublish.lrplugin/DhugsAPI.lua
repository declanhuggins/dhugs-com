-- DhugsAPI.lua - HTTP client for the dhugs.com admin API.
local LrHttp = import "LrHttp"
local LrDialogs = import "LrDialogs"
local LrLogger = import "LrLogger"
local LrPathUtils = import "LrPathUtils"

local logger = LrLogger("DhugsPublish")
logger:enable("logfile")

local DhugsAPI = {}

-- Sanitize a filename for use in R2 keys / URLs.
-- "Dome Dance, Dunne Hall < Orgs-001.avif" -> "dome-dance-dunne-hall-orgs-001.avif"
function DhugsAPI.sanitizeFilename(name)
  local base = LrPathUtils.removeExtension(name) or name
  local ext = LrPathUtils.extension(name) or ""
  base = base:lower()
  base = base:gsub("&", "-and-")
  base = base:gsub("[^%w%-]", "-")
  base = base:gsub("%-+", "-")
  base = base:gsub("^%-+", "")
  base = base:gsub("%-+$", "")
  if ext ~= "" then
    return base .. "." .. ext:lower()
  end
  return base
end

-- Escape a string for safe embedding in a JSON value.
local function jsonEscape(s)
  if not s then return "" end
  s = s:gsub('\\', '\\\\')
  s = s:gsub('"', '\\"')
  s = s:gsub('\n', '\\n')
  s = s:gsub('\r', '\\r')
  s = s:gsub('\t', '\\t')
  return s
end

local CONTENT_TYPES = {
  avif = "image/avif",
  jpg  = "image/jpeg",
  jpeg = "image/jpeg",
  png  = "image/png",
}

-- Upload a single file to R2 via the admin API.
-- @param apiUrl    string  Base URL (e.g., "https://dhugs.com")
-- @param apiToken  string  Bearer token
-- @param filePath  string  Local file path (AVIF)
-- @param r2Key     string  Destination key in R2 (e.g., "o/2025/04/slug/images/photo.avif")
-- @param metadata  table   Optional {width=, height=, alt=}
-- @return boolean, string  success, error message
function DhugsAPI.uploadFile(apiUrl, apiToken, filePath, r2Key, metadata)
  local url = apiUrl .. "/api/admin/upload"
  metadata = metadata or {}

  -- Build multipart form data
  local fileName = LrPathUtils.leafName(filePath) or "image.avif"
  local ext = (LrPathUtils.extension(filePath) or "avif"):lower()
  local contentType = CONTENT_TYPES[ext] or "application/octet-stream"

  local mimeChunks = {
    {
      name = "file",
      filePath = filePath,
      fileName = fileName,
      contentType = contentType,
    },
    { name = "key", value = r2Key },
  }

  if metadata.width then
    mimeChunks[#mimeChunks + 1] = { name = "file_width", value = tostring(metadata.width) }
  end
  if metadata.height then
    mimeChunks[#mimeChunks + 1] = { name = "file_height", value = tostring(metadata.height) }
  end
  if metadata.alt then
    mimeChunks[#mimeChunks + 1] = { name = "file_alt", value = metadata.alt }
  end

  local headers = {
    { field = "Authorization", value = "Bearer " .. apiToken },
  }

  local body, respHeaders = LrHttp.postMultipart(url, mimeChunks, headers)
  if not body then
    return false, "Network error: no response"
  end

  local status = respHeaders and respHeaders.status or 0
  if status ~= 200 then
    logger:trace("Upload failed: " .. tostring(status) .. " " .. tostring(body))
    return false, "HTTP " .. tostring(status) .. ": " .. tostring(body)
  end

  return true, nil
end

-- Upsert album metadata via the admin API.
-- @param apiUrl   string
-- @param apiToken string
-- @param album    table {slug, title, date_utc, timezone, author, tags, excerpt, thumbnail, width}
-- @return boolean, string
function DhugsAPI.upsertAlbum(apiUrl, apiToken, album)
  local url = apiUrl .. "/api/admin/albums"
  local json = '{'
    .. '"slug":"' .. jsonEscape(album.slug or "") .. '"'
    .. ',"title":"' .. jsonEscape(album.title or "") .. '"'
    .. ',"date_utc":"' .. jsonEscape(album.date_utc or "") .. '"'
    .. ',"timezone":"' .. jsonEscape(album.timezone or "America/New_York") .. '"'
    .. ',"author":"' .. jsonEscape(album.author or "Declan Huggins") .. '"'
    .. ',"width":"' .. jsonEscape(album.width or "large") .. '"'

  if album.thumbnail then
    json = json .. ',"thumbnail":"' .. jsonEscape(album.thumbnail) .. '"'
  end
  if album.excerpt then
    json = json .. ',"excerpt":"' .. jsonEscape(album.excerpt) .. '"'
  end
  if album.download_url then
    json = json .. ',"download_url":"' .. jsonEscape(album.download_url) .. '"'
  end

  -- Tags as JSON array
  if album.tags and #album.tags > 0 then
    json = json .. ',"tags":['
    for i, tag in ipairs(album.tags) do
      if i > 1 then json = json .. "," end
      json = json .. '"' .. jsonEscape(tag) .. '"'
    end
    json = json .. ']'
  end

  json = json .. '}'

  logger:trace("Album JSON: " .. json)

  local headers = {
    { field = "Authorization", value = "Bearer " .. apiToken },
    { field = "Content-Type", value = "application/json" },
  }

  local body, respHeaders = LrHttp.post(url, json, headers)
  if not body then
    return false, "Network error: no response"
  end

  local status = respHeaders and respHeaders.status or 0
  if status ~= 200 then
    return false, "HTTP " .. tostring(status) .. ": " .. tostring(body)
  end

  return true, nil
end

-- Trigger cache revalidation.
-- @param apiUrl   string
-- @param apiToken string
-- @param paths    table|nil  List of paths, or nil for full revalidation
-- @return boolean, string
function DhugsAPI.revalidate(apiUrl, apiToken, paths)
  local url = apiUrl .. "/api/admin/revalidate"
  local json
  if paths and #paths > 0 then
    json = '{"paths":['
    for i, p in ipairs(paths) do
      if i > 1 then json = json .. "," end
      json = json .. '"' .. p .. '"'
    end
    json = json .. ']}'
  else
    json = '{"all":true}'
  end

  local headers = {
    { field = "Authorization", value = "Bearer " .. apiToken },
    { field = "Content-Type", value = "application/json" },
  }

  local body, respHeaders = LrHttp.post(url, json, headers)
  local status = respHeaders and respHeaders.status or 0
  return status == 200, tostring(body)
end

-- Delete R2 objects by key.
-- @param apiUrl   string
-- @param apiToken string
-- @param keys     table  List of R2 keys to delete
-- @return boolean, string
function DhugsAPI.deleteKeys(apiUrl, apiToken, keys)
  local url = apiUrl .. "/api/admin/delete"
  local json = '{"keys":['
  for i, k in ipairs(keys) do
    if i > 1 then json = json .. "," end
    json = json .. '"' .. k .. '"'
  end
  json = json .. ']}'

  local headers = {
    { field = "Authorization", value = "Bearer " .. apiToken },
    { field = "Content-Type", value = "application/json" },
  }

  local body, respHeaders = LrHttp.post(url, json, headers)
  local status = respHeaders and respHeaders.status or 0
  return status == 200, tostring(body)
end

return DhugsAPI
