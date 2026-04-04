-- PublishFolder.lua - Publish a folder of images as a dhugs.com album
local LrDialogs = import "LrDialogs"
local LrFunctionContext = import "LrFunctionContext"
local LrView = import "LrView"
local LrBinding = import "LrBinding"
local LrFileUtils = import "LrFileUtils"
local LrPathUtils = import "LrPathUtils"
local LrTasks = import "LrTasks"
local LrLogger = import "LrLogger"
local LrPrefs = import "LrPrefs"
local LrProgressScope = import "LrProgressScope"

local DhugsAPI = require "DhugsAPI"

local logger = LrLogger("DhugsPublish")
logger:enable("logfile")

local NODE = "/opt/homebrew/bin/node"

local SUPPORTED_EXT = {
  avif = true,
  jpg = true,
  jpeg = true,
  png = true,
}

local function scanFolder(path)
  local files = {}
  for f in LrFileUtils.files(path) do
    local ext = LrPathUtils.extension(f)
    if ext and SUPPORTED_EXT[ext:lower()] then
      files[#files + 1] = f
    end
  end
  table.sort(files)
  return files
end

local function parseAlbumUrl(url)
  url = url:gsub("/$", "")
  local year, month, slug = url:match("(%d%d%d%d)/(%d%d)/([%w%-]+)$")
  return year, month, slug
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

local function titleFromSlug(slug)
  local result = slug:gsub("-", " ")
  result = result:gsub("(%a)([%w_']*)", function(a, b)
    return a:upper() .. b
  end)
  return result
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

-- Compute UTC ISO string for 11:59 PM in a given timezone on a given date.
-- Uses Node.js for DST-aware conversion. Falls back to T23:59:00.000Z.
local function localDateToUTC(dateStr, tz)
  local tmpDir = LrPathUtils.getStandardFilePath("temp")
  local tmpOut = LrPathUtils.child(tmpDir, "dhugs-tz-" .. dateStr .. ".txt")
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

-- Auto-populate album fields from folder path.
-- Recognizes: /Volumes/.../YYYY/YYYY-MM-DD Title/AVIF/
local function autoPopulate(props, folderPath)
  if not folderPath or folderPath == "" then return end

  local folderName = LrPathUtils.leafName(folderPath)
  local nameToCheck = folderName

  local upper = folderName:upper()
  if upper == "AVIF" or upper == "JPG" or upper == "JPEG" or upper == "PNG" then
    local parent = LrPathUtils.parent(folderPath)
    if parent then
      nameToCheck = LrPathUtils.leafName(parent)
    end
  end

  local y, m, d, title = nameToCheck:match("^(%d%d%d%d)-(%d%d)-(%d%d)%s+(.+)$")
  if y and title then
    local slug = slugFromTitle(title)
    props.albumUrl = y .. "/" .. m .. "/" .. slug
    props.title = title
    props.albumDate = y .. "-" .. m .. "-" .. d
  end

  -- Pre-populate thumbnail with first image
  local images = scanFolder(folderPath)
  if #images > 0 then
    props.thumbChoice = "1"
    props.imageCount = #images
  end
end

local function getVariantScript()
  local pluginPath = _PLUGIN.path
  local projectRoot = LrPathUtils.parent(
    LrPathUtils.parent(LrPathUtils.parent(pluginPath)))
  return LrPathUtils.child(projectRoot, "scripts/generate-variants.js")
end

local function doPublish()
  LrFunctionContext.callWithContext("publishFolder", function(context)
    local prefs = LrPrefs.prefsForPlugin()
    local f = LrView.osFactory()
    local bind = LrView.bind
    local props = LrBinding.makePropertyTable(context)

    props.apiUrl = prefs.apiUrl or "https://dhugs.com"
    props.apiToken = prefs.apiToken or ""
    props.author = prefs.author or "Declan Huggins"
    props.timezone = prefs.timezone or "America/New_York"
    props.tags = prefs.defaultTags or "Photography"
    props.albumUrl = ""
    props.folderPath = ""
    props.title = ""
    props.albumDate = ""
    props.thumbChoice = "1"
    props.imageCount = 0

    props:addObserver("folderPath", function(properties, key, newValue)
      autoPopulate(properties, newValue)
    end)

    local contents = f:column {
      spacing = f:control_spacing(),
      bind_to_object = props,

      f:group_box {
        title = "Album",
        fill_horizontal = 1,
        spacing = f:control_spacing(),

        f:row {
          f:static_text { title = "Folder:", width = 80 },
          f:static_text {
            title = bind "folderPath",
            truncation = "head",
            width_in_chars = 30,
          },
          f:push_button {
            title = "Browse...",
            action = function()
              local paths = LrDialogs.runOpenPanel {
                title = "Select image folder",
                canChooseDirectories = true,
                canChooseFiles = false,
                allowsMultipleSelection = false,
              }
              if paths then
                props.folderPath = paths[1]
              end
            end,
          },
        },

        f:row {
          f:static_text { title = "Album URL:", width = 80 },
          f:edit_field {
            value = bind "albumUrl",
            width_in_chars = 40,
            tooltip = "YYYY/MM/slug - auto-filled from folder name",
          },
        },

        f:row {
          f:static_text { title = "Title:", width = 80 },
          f:edit_field { value = bind "title", width_in_chars = 40 },
        },

        f:row {
          f:static_text { title = "Tags:", width = 80 },
          f:edit_field { value = bind "tags", width_in_chars = 40 },
        },

        f:row {
          f:static_text { title = "Thumbnail:", width = 80 },
          f:edit_field {
            value = bind "thumbChoice",
            width_in_chars = 6,
            tooltip = "Image number (1 = first image)",
          },
          f:static_text { title = "(image # to use as thumbnail)" },
        },
      },

      f:group_box {
        title = "Connection",
        fill_horizontal = 1,
        spacing = f:control_spacing(),

        f:row {
          f:static_text { title = "Endpoint:", width = 80 },
          f:static_text { title = "https://dhugs.com" },
        },

        f:row {
          f:static_text { title = "API Token:", width = 80 },
          f:password_field { value = bind "apiToken", width_in_chars = 40 },
        },

        f:row {
          f:static_text { title = "Author:", width = 80 },
          f:edit_field { value = bind "author", width_in_chars = 30 },
        },

        f:row {
          f:static_text { title = "Timezone:", width = 80 },
          f:edit_field { value = bind "timezone", width_in_chars = 30 },
        },
      },
    }

    local result = LrDialogs.presentModalDialog {
      title = "Publish Album to dhugs.com",
      actionVerb = "Publish",
      contents = contents,
    }

    if result == "cancel" then return end

    -- Save connection settings
    prefs.apiUrl = props.apiUrl
    prefs.apiToken = props.apiToken
    prefs.author = props.author
    prefs.timezone = props.timezone
    prefs.defaultTags = props.tags

    -- Validate
    if not props.apiToken or props.apiToken == "" then
      LrDialogs.message("Error", "API Token is required.", "critical")
      return
    end

    local year, month, slug = parseAlbumUrl(props.albumUrl)
    if not year then
      LrDialogs.message("Error",
        "Album URL must be YYYY/MM/slug (e.g. 2025/04/spring-photos)",
        "critical")
      return
    end

    local folderPath = props.folderPath
    if not folderPath or folderPath == "" or not LrFileUtils.exists(folderPath) then
      LrDialogs.message("Error", "Select a valid image folder.", "critical")
      return
    end

    local files = scanFolder(folderPath)
    if #files == 0 then
      LrDialogs.message("Error",
        "No images (AVIF/JPG/PNG) found in that folder.", "critical")
      return
    end

    local title = props.title
    if not title or title == "" then
      title = titleFromSlug(slug)
    end

    local albumPath = year .. "/" .. month .. "/" .. slug
    local tags = parseTags(props.tags)

    -- Determine thumbnail source file
    local thumbIdx = tonumber(props.thumbChoice) or 1
    if thumbIdx < 1 then thumbIdx = 1 end
    if thumbIdx > #files then thumbIdx = #files end
    local thumbFile = files[thumbIdx]

    -- Resolve paths for Node script
    local variantScript = getVariantScript()
    local canGenerate = LrFileUtils.exists(variantScript)
      and LrFileUtils.exists(NODE)

    -- Total steps: process images (convert + upload + variants) + thumbnail + metadata
    local totalSteps = #files + 1 + 1
    local step = 0

    local progress = LrProgressScope { title = "Publishing to dhugs.com" }
    local uploaded = 0
    local errors = {}

    if not canGenerate then
      progress:done()
      LrDialogs.message("Error",
        "Node.js or generate-variants.js not found.\n\n"
        .. "Node: " .. NODE .. "\n"
        .. "Script: " .. tostring(variantScript),
        "critical")
      return
    end

    -- Step 1: Per image - convert to AVIF, upload original, generate s/m/l
    for i, filePath in ipairs(files) do
      if progress:isCanceled() then break end
      step = step + 1
      progress:setPortionComplete(step, totalSteps)

      local origName = LrPathUtils.leafName(filePath)
      local safeName = DhugsAPI.sanitizeFilename(origName)
      -- Ensure .avif extension in display
      local avifName = safeName:gsub("%.[^%.]+$", ".avif")

      progress:setCaption(
        string.format("Processing %d/%d: %s", i, #files, avifName))

      local cmd = string.format(
        '"%s" "%s" --file "%s" --safe-name "%s" --album "%s" --api-url "%s" --api-token "%s" --upload-original',
        NODE, variantScript, filePath, safeName, albumPath,
        props.apiUrl, props.apiToken)
      local exitCode = LrTasks.execute(cmd)
      if exitCode == 0 then
        uploaded = uploaded + 1
      else
        errors[#errors + 1] = avifName .. ": variant/upload failed (exit " .. tostring(exitCode) .. ")"
        logger:trace("Process failed: " .. filePath .. " exit=" .. tostring(exitCode))
      end
    end

    if uploaded == 0 then
      progress:done()
      LrDialogs.message("Error",
        "No files processed.\n\n" .. table.concat(errors, "\n"), "critical")
      return
    end

    -- Step 2: Generate thumbnail (3:2 crop, AVIF + JPG at o/s/m/l)
    step = step + 1
    progress:setPortionComplete(step, totalSteps)
    progress:setCaption("Generating thumbnail from image #"
      .. tostring(thumbIdx) .. "...")

    local thumbCmd = string.format(
      '"%s" "%s" --thumb "%s" --album "%s" --api-url "%s" --api-token "%s"',
      NODE, variantScript, thumbFile, albumPath,
      props.apiUrl, props.apiToken)
    local thumbExit = LrTasks.execute(thumbCmd)
    if thumbExit ~= 0 then
      LrDialogs.message("Warning", "Thumbnail generation failed.", "warning")
    end

    -- Step 4: Upsert album metadata
    step = step + 1
    progress:setPortionComplete(step, totalSteps)
    progress:setCaption("Saving album metadata...")
    -- Default to 11:59 PM local time, converted to UTC
    local isoDate
    local tz = props.timezone or "America/New_York"
    if props.albumDate and props.albumDate ~= "" then
      isoDate = localDateToUTC(props.albumDate, tz)
    else
      isoDate = localDateToUTC(year .. "-" .. month .. "-15", tz)
    end
    local thumbnailUrl = "https://cdn.dhugs.com/o/" .. albumPath .. "/thumbnail.avif"

    local ok, err = DhugsAPI.upsertAlbum(props.apiUrl, props.apiToken, {
      slug = slug,
      title = title,
      date_utc = isoDate,
      timezone = props.timezone,
      author = props.author,
      tags = tags,
      thumbnail = thumbnailUrl,
      width = "large",
    })

    if not ok then
      LrDialogs.message("Warning",
        "Album metadata failed: " .. (err or "unknown"), "warning")
    end

    -- Revalidate cache
    progress:setCaption("Revalidating cache...")
    DhugsAPI.revalidate(props.apiUrl, props.apiToken, {
      "/" .. albumPath,
      "/",
      "/archive",
      "/recent",
    })

    progress:done()

    local msg = string.format("Published %d/%d images to /%s",
      uploaded, #files, albumPath)
    if #errors > 0 then
      msg = msg .. "\n\nFailed:\n" .. table.concat(errors, "\n")
    end
    LrDialogs.message("dhugs.com Publish", msg, "info")
  end)
end

LrTasks.startAsyncTask(doPublish)
