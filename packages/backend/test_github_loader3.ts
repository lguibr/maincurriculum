import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";

async function run() {
  const loader = new GithubRepoLoader("https://github.com/lguibr/daicer", { branch: "main", recursive: false });
  try {
     await loader.load();
     console.log("Success");
  } catch (e: any) {
     console.log(e.message);
  }
}
run();
