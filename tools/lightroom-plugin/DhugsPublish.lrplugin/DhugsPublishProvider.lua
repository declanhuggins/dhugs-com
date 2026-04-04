-- DhugsPublishProvider.lua - Lightroom Publish Service for dhugs.com
local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
local LrLogger = import "LrLogger"
local LrPathUtils = import "LrPathUtils"
local LrFileUtils = import "LrFileUtils"
local LrTasks = import "LrTasks"
local LrProgressScope = import "LrProgressScope"

local DhugsAPI = require "DhugsAPI"

local NODE = "/opt/homebrew/bin/node"

local logger = LrLogger("DhugsPublish")
logger:enable("logfile")

local provider = {}

-- ---------------------------------------------------------------------------
-- Publish service capabilities
-- ---------------------------------------------------------------------------
provider.supportsIncrementalPublish = true
provider.small_icon = nil
provider.canAddCommentsToService = false
provider.supportsCustomSortOrder = false

-- Hide export UI that does not apply to this workflow.
-- Keep "fileSettings" visible so the user can pick AVIF format/quality.
provider.hideSections = {
  "exportLocation",
  "fileNaming",
  "fileSettings",
  "imageSettings",
  "outputSharpening",
  "metadata",
  "watermarking",
  "video",
  "postProcessing",
}

-- Force JPEG export from Lightroom as an intermediate format.
-- The Node script converts to AVIF for R2 storage.
-- LrC's native AVIF uses bitstream v2.0 which sharp/libheif can't decode.
provider.allowFileFormats = { "JPEG" }
provider.allowColorSpaces = { "sRGB" }

-- Service-level settings persisted with the publish connection
provider.exportPresetFields = {
  { key = "apiUrl",      default = "https://dhugs.com" },
  { key = "apiToken",    default = "" },
  { key = "author",      default = "Declan Huggins" },
  { key = "timezone",    default = "America/New_York" },
  { key = "LR_format",          default = "JPEG" },
  { key = "LR_export_colorSpace", default = "sRGB" },
  { key = "LR_jpeg_quality",    default = 1.0 },
}

-- ---------------------------------------------------------------------------
-- Connection settings (top of publish manager dialog)
-- ---------------------------------------------------------------------------
function provider.sectionsForTopOfDialog(f, propertyTable)
  local bind = LrView.bind

  return {
    {
      title = "dhugs.com Connection",
      synopsis = bind "apiUrl",

      f:row {
        spacing = f:control_spacing(),
        f:static_text { title = "API Token:", width = 100 },
        f:password_field {
          value = bind "apiToken",
          width_in_chars = 40,
          tooltip = "From 1Password: ADMIN_API_TOKEN",
        },
      },

      f:row {
        spacing = f:control_spacing(),
        f:static_text { title = "Default Author:", width = 100 },
        f:edit_field { value = bind "author", width_in_chars = 30 },
      },

      f:row {
        spacing = f:control_spacing(),
        f:static_text { title = "Timezone:", width = 100 },
        f:edit_field { value = bind "timezone", width_in_chars = 30 },
      },

    },
  }
end

-- ---------------------------------------------------------------------------
-- Collection behaviour
-- ---------------------------------------------------------------------------
function provider.getCollectionBehaviorInfo(publishSettings)
  return {
    defaultCollectionName = "YYYY-MM-DD Album Title",
    defaultCollectionCanBeDeleted = true,
    canAddCollection = true,
  }
end

-- Per-collection settings UI (shown when creating/editing a collection)
function provider.viewForCollectionSettings(f, publishSettings, info)
  local bind = LrView.bind
  local collectionSettings = info.collectionSettings

  -- Set defaults for new collections
  if not collectionSettings.tags or collectionSettings.tags == "" then
    collectionSettings.tags = "Photography"
  end
  if not collectionSettings.downloadUrl then
    collectionSettings.downloadUrl = ""
  end

  return f:group_box {
    title = "Album Settings",
    fill_horizontal = 1,
    spacing = f:control_spacing(),
    bind_to_object = collectionSettings,

    f:row {
      spacing = f:control_spacing(),
      f:static_text { title = "Tags:", width = 100 },
      f:edit_field {
        value = bind "tags",
        width_in_chars = 40,
        tooltip = "Comma-separated tags for this album",
      },
    },

    f:row {
      spacing = f:control_spacing(),
      f:static_text { title = "Download URL:", width = 100 },
      f:edit_field {
        value = bind "downloadUrl",
        width_in_chars = 40,
        tooltip = "Link to original PNGs (Google Photos, Drive, iCloud, etc.)",
      },
    },
  }
end

-- Which metadata changes should mark a photo as needing re-publish
function provider.metadataThatTriggersRepublish(publishSettings)
  return {
    default  = false,
    title    = true,
    keywords = true,
  }
end

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
local function parseCollectionName(name)
  local y, m, d, title = name:match("^(%d%d%d%d)-(%d%d)-(%d%d)%s+(.+)$")
  if y then
    return y, m, d, title
  end
  return nil, nil, nil, name
end

local function slugFromTitle(title)
  local s = title:lower()
  s = s:gsub("&", " and ")
  s = s:gsub("[^%w%s%-]", "")
  s = s:gsub("%s+", "-")
  s = s:gsub("%-+", "-")
  s = s:gsub("^%-+", "")
  s = s:gsub("%-+$", "")
  return s
end

-- Compute UTC ISO string for 11:59 PM in a given timezone on a given date.
-- Uses Node.js for DST-aware conversion. Falls back to T23:59:00.000Z.
local function localDateToUTC(dateStr, tz)
  local tmpDir = LrPathUtils.getStandardFilePath("temp")
  local tmpOut = LrPathUtils.child(tmpDir, "dhugs-tz-" .. dateStr .. ".txt")
  -- We want: "YYYY-MM-DD 23:59" in timezone tz -> UTC ISO string
  -- Strategy: binary-search for the UTC instant where formatting in tz gives 23:59
  local js = string.format(
    'const [y,m,d]="%s".split("-").map(Number);'
    .. 'let guess=new Date(Date.UTC(y,m-1,d,23,59));'
    .. 'for(let i=0;i<3;i++){'
    .. 'const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",'
    .. '{timeZone:"%s",year:"numeric",month:"2-digit",day:"2-digit",'
    .. 'hour:"2-digit",minute:"2-digit",hour12:false})'
    .. '.formatToParts(guess).map(x=>[x.type,x.value]));'
    .. 'const localMs=Date.UTC(+p.year,+p.month-1,+p.day,'
    .. 'p.hour==="24"?0:+p.hour,+p.minute);'
    .. 'const wantMs=Date.UTC(y,m-1,d,23,59);'
    .. 'guess=new Date(guess.getTime()+(wantMs-localMs));'
    .. '}'
    .. 'process.stdout.write(guess.toISOString())',
    dateStr, tz)
  local cmd = string.format('"%s" -e \'%s\' > "%s" 2>/dev/null', NODE, js, tmpOut)
  local exitCode = LrTasks.execute(cmd)
  local result = nil
  if exitCode == 0 then
    local f = io.open(tmpOut, "r")
    if f then
      result = f:read("*a")
      f:close()
    end
  end
  LrFileUtils.delete(tmpOut)
  if result and result:match("^%d%d%d%d%-%d%d%-%d%d") then
    return result:gsub("%s+$", "")
  end
  return dateStr .. "T23:59:00.000Z"
end

local function parseTags(str)
  local tags = {}
  for tag in (str or ""):gmatch("[^,]+") do
    local trimmed = tag:match("^%s*(.-)%s*$")
    if trimmed and trimmed ~= "" then
      tags[#tags + 1] = trimmed
    end
  end
  return tags
end

-- Build a clean R2 filename from the Lightroom photo.
-- Uses the original camera filename (e.g. IMG_2153) to keep names stable
-- across re-publishes, then appends the rendered extension.
local function r2Filename(renderedPath, photo)
  local origFile = photo:getFormattedMetadata("fileName") or ""
  local base = LrPathUtils.removeExtension(origFile)
  if not base or base == "" then
    base = LrPathUtils.removeExtension(LrPathUtils.leafName(renderedPath)) or "image"
  end
  -- Sanitize the base name
  base = base:lower()
  base = base:gsub("[^%w%-_]", "-")
  base = base:gsub("%-+", "-")
  base = base:gsub("^%-+", "")
  base = base:gsub("%-+$", "")

  local ext = (LrPathUtils.extension(renderedPath) or "jpg"):lower()
  return base .. "." .. ext
end

-- ---------------------------------------------------------------------------
-- Process rendered photos (handles both new and modified)
-- ---------------------------------------------------------------------------
function provider.processRenderedPhotos(functionContext, exportContext)
  local exportSession = exportContext.exportSession
  local publishSettings = exportContext.propertyTable

  local apiUrl = publishSettings.apiUrl
  local apiToken = publishSettings.apiToken
  local author = publishSettings.author or "Declan Huggins"
  local timezone = publishSettings.timezone or "America/New_York"

  if not apiToken or apiToken == "" then
    LrDialogs.message("dhugs.com Publish",
      "API Token is required. Set it in the publish service settings.",
      "critical")
    return
  end

  -- Parse album info from collection name
  local collectionInfo = exportContext.publishedCollectionInfo
  local collectionName = collectionInfo.name or "Untitled Album"
  local remoteId = collectionInfo.remoteId

  local year, month, day, title = parseCollectionName(collectionName)
  if not year then
    year = os.date("%Y")
    month = os.date("%m")
    day = os.date("%d")
    title = collectionName
  end

  local slug = slugFromTitle(title)
  local dateStr = year .. "-" .. month .. "-" .. day
  local isoDate = localDateToUTC(dateStr, timezone)
  local albumPath = year .. "/" .. month .. "/" .. slug

  -- Read per-collection settings
  local collectionSettings = collectionInfo.collectionSettings or {}
  local tags = parseTags(collectionSettings.tags or "Photography")

  local pluginPath = _PLUGIN.path
  local projectRoot = LrPathUtils.parent(
    LrPathUtils.parent(LrPathUtils.parent(pluginPath)))
  local variantScript = LrPathUtils.child(projectRoot,
    "scripts/generate-variants.js")
  local canGenerate = LrFileUtils.exists(variantScript)
    and LrFileUtils.exists(NODE)

  logger:trace("Plugin path: " .. tostring(pluginPath))
  logger:trace("Project root: " .. tostring(projectRoot))
  logger:trace("Variant script: " .. tostring(variantScript))
  logger:trace("Script exists: " .. tostring(LrFileUtils.exists(variantScript)))
  logger:trace("Node exists: " .. tostring(LrFileUtils.exists(NODE)))
  logger:trace("canGenerate: " .. tostring(canGenerate))

  if not canGenerate then
    LrDialogs.message("dhugs.com Publish",
      "Node.js or generate-variants.js not found.\n\n"
      .. "Script: " .. tostring(variantScript) .. "\n"
      .. "Node: " .. NODE,
      "critical")
    return
  end

  local nPhotos = exportSession:countRenditions()
  -- Steps: render+process each photo + thumbnail + metadata
  local totalSteps = nPhotos + 1 + 1
  local progress = LrProgressScope {
    title = "Publishing to dhugs.com",
    functionContext = functionContext,
  }

  local uploadedCount = 0
  local firstTempFile = nil
  local thumbTempFile = nil  -- photo tagged "thumbnail"
  local tempFiles = {}
  local step = 0

  for i, rendition in exportContext:renditions() do
    local success, pathOrMessage = rendition:waitForRender()
    if not success then
      rendition:uploadFailed(pathOrMessage)
    else
      local filePath = pathOrMessage
      local photo = rendition.photo
      local fileName = r2Filename(filePath, photo)
      -- Ensure .avif extension
      local avifName = fileName:gsub("%.[^%.]+$", ".avif")
      local r2Key = "o/" .. albumPath .. "/images/" .. avifName

      -- Check if this photo has a "thumbnail" keyword
      if not thumbTempFile then
        local keywords = photo:getRawMetadata("keywords") or {}
        for _, kw in ipairs(keywords) do
          local kwName = kw:getName():lower()
          if kwName == "thumbnail" or kwName == "thumb" then
            thumbTempFile = filePath
            logger:trace("Thumbnail keyword found on: " .. avifName)
            break
          end
        end
      end

      step = step + 1
      progress:setPortionComplete(step, totalSteps)
      progress:setCaption(
        string.format("Processing %d/%d: %s", i, nPhotos, avifName))

      logger:trace("Processing: " .. filePath .. " -> " .. r2Key)

      -- Write args to a temp JSON file to avoid shell escaping issues
      local tmpDir = LrPathUtils.getStandardFilePath("temp")
      local argsFile = LrPathUtils.child(tmpDir, "dhugs-args.json")
      local errLog = LrPathUtils.child(tmpDir, "dhugs-variant-err.log")
      local af = io.open(argsFile, "w")
      if af then
        af:write('{"file":' .. '"' .. filePath:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
          .. ',"safe-name":"' .. fileName .. '"'
          .. ',"album":"' .. albumPath .. '"'
          .. ',"api-url":"' .. apiUrl .. '"'
          .. ',"api-token":"' .. apiToken:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
          .. ',"upload-original":true}')
        af:close()
      end

      local cmd = string.format(
        '"%s" "%s" --args-file "%s" 2>"%s"',
        NODE, variantScript, argsFile, errLog)
      logger:trace("CMD: " .. cmd)
      local exitCode = LrTasks.execute(cmd)

      if exitCode ~= 0 then
        local ef = io.open(errLog, "r")
        if ef then
          local errText = ef:read("*a") or ""
          ef:close()
          logger:trace("Node stderr: " .. errText)
        end
      end
      LrFileUtils.delete(argsFile)

      if exitCode == 0 then
        rendition:recordPublishedPhotoId(r2Key)
        rendition:recordPublishedPhotoUrl(
          "https://cdn.dhugs.com/" .. r2Key)
        uploadedCount = uploadedCount + 1
        tempFiles[#tempFiles + 1] = { path = filePath, safeName = avifName }
        if not firstTempFile then
          firstTempFile = filePath
        end
      else
        rendition:uploadFailed("Processing failed (exit " .. tostring(exitCode) .. ")")
        logger:trace("Process failed (exit " .. tostring(exitCode)
          .. ") for " .. fileName)
        LrFileUtils.delete(filePath)
      end
    end
  end

  if uploadedCount == 0 then
    return
  end

  -- Generate thumbnail: prefer photo with "thumbnail" keyword, else first image
  local thumbSource = thumbTempFile or firstTempFile
  step = step + 1
  progress:setPortionComplete(step, totalSteps)
  progress:setCaption("Generating thumbnail...")

  if thumbSource then
    logger:trace("Generating thumbnail from " .. thumbSource
      .. (thumbTempFile and " (keyword)" or " (first image)"))
    local tmpDir = LrPathUtils.getStandardFilePath("temp")
    local thumbArgsFile = LrPathUtils.child(tmpDir, "dhugs-thumb-args.json")
    local taf = io.open(thumbArgsFile, "w")
    if taf then
      taf:write('{"thumb":' .. '"' .. thumbSource:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
        .. ',"album":"' .. albumPath .. '"'
        .. ',"api-url":"' .. apiUrl .. '"'
        .. ',"api-token":"' .. apiToken:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
        .. '}')
      taf:close()
    end
    local thumbCmd = string.format(
      '"%s" "%s" --args-file "%s"',
      NODE, variantScript, thumbArgsFile)
    local thumbExit = LrTasks.execute(thumbCmd)
    LrFileUtils.delete(thumbArgsFile)
    if thumbExit ~= 0 then
      LrDialogs.message("dhugs.com Publish",
        "Thumbnail generation failed (exit " .. tostring(thumbExit) .. ").",
        "warning")
    end
  end

  -- Clean up temp files
  for _, entry in ipairs(tempFiles) do
    LrFileUtils.delete(entry.path)
  end

  -- Upsert album metadata
  step = step + 1
  progress:setPortionComplete(step, totalSteps)
  progress:setCaption("Saving album metadata...")

  local thumbnailUrl = "https://cdn.dhugs.com/o/" .. albumPath .. "/thumbnail.avif"

  local downloadUrl = collectionSettings.downloadUrl
  if downloadUrl and downloadUrl ~= "" then
    logger:trace("Download URL: " .. downloadUrl)
  end

  local ok, err = DhugsAPI.upsertAlbum(apiUrl, apiToken, {
    slug = slug,
    title = title,
    date_utc = isoDate,
    timezone = timezone,
    author = author,
    tags = tags,
    thumbnail = thumbnailUrl,
    width = "large",
    download_url = (downloadUrl and downloadUrl ~= "") and downloadUrl or nil,
  })

  if not ok then
    LrDialogs.message("dhugs.com Publish",
      "Album metadata failed: " .. (err or "unknown error"), "warning")
  end

  -- Revalidate
  progress:setCaption("Revalidating cache...")
  DhugsAPI.revalidate(apiUrl, apiToken, {
    "/" .. albumPath,
    "/",
    "/archive",
    "/recent",
  })

  progress:done()

  -- Store album path as the collection's remote ID
  if not remoteId then
    exportContext.publishedCollectionInfo.remoteId = albumPath
  end

  LrDialogs.message("dhugs.com Publish",
    string.format("Published %d/%d photos to /%s",
      uploadedCount, nPhotos, albumPath),
    "info")
end

-- ---------------------------------------------------------------------------
-- Handle photo deletion from a published collection.
-- Deletes the image from R2 across all size prefixes (o/s/m/l).
-- ---------------------------------------------------------------------------
function provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback, progressScope)
  local apiUrl = publishSettings.apiUrl
  local apiToken = publishSettings.apiToken

  for i, remoteId in ipairs(arrayOfPhotoIds) do
    logger:trace("Deleting: " .. tostring(remoteId))

    -- remoteId is like "o/2026/01/slug/images/photo.avif"
    -- Delete across all size prefixes
    local keys = {}
    local basePath = tostring(remoteId):gsub("^o/", "")
    for _, prefix in ipairs({ "o/", "s/", "m/", "l/" }) do
      keys[#keys + 1] = prefix .. basePath
    end

    if apiToken and apiToken ~= "" then
      local ok, err = DhugsAPI.deleteKeys(apiUrl, apiToken, keys)
      if ok then
        logger:trace("Deleted from R2: " .. basePath)
      else
        logger:trace("R2 delete failed: " .. tostring(err))
      end
    end

    deletedCallback(remoteId)
  end
end

return provider
