export async function fetchGithubCodebase(repoName: string, description: string, headers: any, onProgress: (msg: string, prog: number) => void): Promise<string> {
  let codebaseStr = `Repository: ${repoName}\\nDescription: ${description || ""}\\n\\n`;
  try {
    let treeRes = await fetch(`https://api.github.com/repos/${repoName}/git/trees/main?recursive=1`, { headers });
    let treeData = await treeRes.json();
    if (treeRes.status === 404 || treeData.message?.includes("Not Found")) {
      const masterRes = await fetch(`https://api.github.com/repos/${repoName}/git/trees/master?recursive=1`, { headers });
      treeData = await masterRes.json();
    }
    if (Array.isArray(treeData.tree)) {
      const exclusions = [".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webp", ".lock", "node_modules/", "dist/", "build/", ".git", "package-lock.json", "yarn.lock", ".svg", ".min.js"];
      let files = treeData.tree.filter((t: any) => t.type === "blob" && !exclusions.some((ex) => t.path.toLowerCase().includes(ex))).slice(0, 15);
      
      const fileHeaders = { ...headers, Accept: "application/vnd.github.v3.raw" };
      for (let j = 0; j < files.length; j++) {
        const file = files[j];
        onProgress(`Reading file ${j+1}/${files.length}...`, 20 + Math.round((j / files.length) * 30));
        let text = "";
        let fileRes = await fetch(`https://api.github.com/repos/${repoName}/contents/${file.path}?ref=main`, { headers: fileHeaders });
        if (fileRes.ok) {
          text = await fileRes.text();
        } else {
          fileRes = await fetch(`https://api.github.com/repos/${repoName}/contents/${file.path}?ref=master`, { headers: fileHeaders });
          if (fileRes.ok) text = await fileRes.text();
        }
        if (text) codebaseStr += `\\n--- FILE: ${file.path} ---\\n${text.substring(0, 3000)}\\n`;
      }
    }
  } catch (e) {
    console.warn(`Failed codebase fetch for ${repoName}`, e);
  }
  return codebaseStr;
}
