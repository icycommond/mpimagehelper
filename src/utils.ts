import fs from "fs";
import path from "path";

// import fetch from "node-fetch";
import axios from "axios";
import sizeOf from "image-size";

export enum IMAGE_TYPE {
  Online = 1,
  Local = 2,
  Base64 = 3,
}
export interface IImage {
  type: IMAGE_TYPE;
  path: string;
}

/** 远程图片的正则 */
export const urlRegexp =
    /https?:\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|](?=&quot;|[\s)])/g;

/**
 * 图片是否有协议头
 * @param {IImage} image 图片
 */
export function hasProtocol(image: string) {
  if (image.slice(0, 2) !== "//") {
    return true;
  }
  return false;
}

/**
 * 增加协议头
 * @param {string} image 图片地址
 */
export function addHttpsProtocol(image: string) {
  if (!hasProtocol(image)) {
    return `https:${image}`;
  }
  return image;
}

/**
 * 从一段文本中提取出网络地址
 * @param {string} content 文本内容
 * @param {object} options
 * @param {(string | RegExp)[]} options.ignore 忽略的图片地址
 */
export function extraOnlinePath(
  content: string,
  { ignore, col }: { ignore?: (string | RegExp)[]; col?: number } = {}
) {
  const res = content.match(urlRegexp);
  if (res === null) {
    return null;
  }
  if (col === undefined) {
    return res[0];
  }
  const matchedResultIndexRanges = res.map((result) => {
    const index = content.indexOf(result);
    return {
      s: index,
      e: index + result.length,
      c: result,
    };
  });
  const matchedResultInRange = matchedResultIndexRanges.find((range) => {
    return range.s <= col && range.e >= col;
  });
  if (!matchedResultInRange) {
    return res[0];
  }
  return matchedResultInRange.c;
}

/**
 * 从一段文本中提取出本地图片地址
 * @param {string} content 文本
 * @param {object} options 配置
 * @param {(string | RegExp)[]} options.ignore 需要忽略的地址
 */
export function extraLocalPath(
  content: string,
  options: { ignore?: (string | RegExp)[] } = {}
) {
  const isImportModule =
    content.match(/import\b/) || content.indexOf("require") !== -1;
  if (isImportModule) {
    return null;
  }
  const linuxRegexp =
    /(?:[A-Z]:|\\|(?:\.{1,2}[\/\\])+)[\w+\\\s_\(\)\/]+(?:\.\w+)*/;
  let file = content.match(linuxRegexp);
  if (file === null) {
    return null;
  }
  const filepath = file[0];
  const { ext } = path.parse(filepath);
  if (ext === "") {
    return null;
  }
  const { ignore } = options;
  if (ignore === undefined) {
    return filepath;
  }
  if (!Array.isArray(ignore)) {
    return filepath;
  }
  if (ignore.length === 0) {
    return filepath;
  }
  const needIgnore = ignore.some((stringOrRegexp) => {
    // console.log("[]ignore", stringOrRegexp, filepath);
    if (typeof stringOrRegexp === "string") {
      return stringOrRegexp === filepath;
    }
    return stringOrRegexp.test(filepath);
  });
  if (needIgnore) {
    return null;
  }
  return filepath;
}

export function extraBase64(content: string) {
  const regexp = /data:image\/[a-zA-Z]{1,};base64,([A-Za-z0-9+/=]{1,})/;
  const matched = content.match(regexp);
  if (!matched) {
    return null;
  }
  return matched[0];
}

/**
 * 从一段文本中提取出图片地址，网络图片或者本地图片
 * @param {string} content 文本
 * @param {object} options 额外选项
 * @param {string} options.dir 项目根路径
 * @param {string} options.col 鼠标在当前行的列下标
 * @param {(string | RegExp)[]} options.ignore 要忽略的路径，支持字符串或正则
 */
export function extraPath(
  content: string,
  options: { dir: string; col: number; ignore: (string | RegExp)[] }
) {
  const { dir, ignore, col } = options || {};
  const base64 = extraBase64(content);
  if (base64 !== null) {
    return {
      type: IMAGE_TYPE.Base64,
      path: base64 ?? null,
    };
  }
  const onlinePath = extraOnlinePath(content, { ignore, col });
  if (onlinePath !== null) {
    return {
      type: IMAGE_TYPE.Online,
      path: addHttpsProtocol(onlinePath) ?? null,
    };
  }
  let localPath = extraLocalPath(content, { ignore });
  if (localPath !== null) {
    return {
      type: IMAGE_TYPE.Local,
      path: normalizeLocalFilepath(localPath, dir) ?? null,
    };
  }
  return null;
}

/**
 * 获取本地图片的完整路径
 * @param {IImage} filepath 图片
 * @param {string} dir 相对根目录
 */
export function normalizeLocalFilepath(filepath: string, dir: string) {
  const url = filepath;
  const r = path.resolve(dir, url);
  if (r.match(/^[a-zA-Z]:\\/)) {
    return "/" + r.replace(/\\/g, "/");
  }
  return r;
}

/**
 * from https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
export function humanFileSize(bytes: number, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + " " + units[u];
}

/**
 * 获取图片信息，尺寸和大小
 * @param {IImage} image 图片
 */
export async function fetchImgInfo(
  image: IImage
): Promise<{ width: number; height: number; }> {
  const { type, path: imagePath } = image;
  if (type === IMAGE_TYPE.Online) {
    return axios
      .get(imagePath, {
        responseType: "arraybuffer", // 以 Buffer 的形式获取数据
      })
      .then((res) => {
        const size = sizeOf(Buffer.from(res.data));
        return {
          width: size.width!,
          height: size.height!,
        };
      });
  }
  const buffer = fs.readFileSync(imagePath);
  const { width, height } = sizeOf(buffer);
  return Promise.resolve({
    width: width!,
    height: height!,
  });
}
