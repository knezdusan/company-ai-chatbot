import { convert } from "html-to-text";
import * as fs from "fs/promises";

// import content from scrp.txt file
async function getContent(path: string): Promise<string | null> {
  try {
    const content = await fs.readFile(path, "utf8");
    return content;
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`Error reading file ${path}:`, err.message);
    } else {
      console.error(`Unknown error occurred while reading ${path}:`, err);
    }
    return null;
  }
}

export default async function Test() {
  const html = await getContent("scrp.txt");
  // const plainText = stripHtml(content || "");
  const plainText = convert(html);

  console.log("*-*-*-*-*-*-*-*-*--*-> Content:", plainText);

  return <div>Test</div>;
}
