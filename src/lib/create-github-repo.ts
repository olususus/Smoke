import {
  createGitHubRepository,
  fetchGitignoreTemplate,
  fetchLicenseBody,
  validateRepoName,
} from "./github-repos";

export interface CreateRepoOptions {
  name: string;
  description: string;
  localPath: string;
  ownerLogin: string;
  userLogin: string;
  isPrivate: boolean;
  gitignoreTemplate: string | null;
  licenseKey: string | null;
  initReadme: boolean;
}

export interface PublishRepoOptions {
  repoPath: string;
  name: string;
  description: string;
  ownerLogin: string;
  userLogin: string;
  isPrivate: boolean;
  commitMessage?: string;
}

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke: inv } = await import("@tauri-apps/api/core");
  return inv<T>(cmd, args);
}

export function buildReadmeContent(name: string, description: string): string {
  const title = name.trim();
  if (description.trim()) {
    return `# ${title}\n\n${description.trim()}\n`;
  }
  return `# ${title}\n`;
}

export async function bootstrapLocalRepoFiles(
  repoPath: string,
  options: Pick<CreateRepoOptions, "name" | "description" | "gitignoreTemplate" | "licenseKey" | "initReadme">
): Promise<void> {
  if (options.gitignoreTemplate) {
    const source = await fetchGitignoreTemplate(options.gitignoreTemplate);
    if (source) {
      await invoke("write_repo_file", {
        repoPath,
        filePath: ".gitignore",
        content: source,
      });
    }
  }
  if (options.licenseKey) {
    const body = await fetchLicenseBody(options.licenseKey);
    if (body) {
      await invoke("write_repo_file", {
        repoPath,
        filePath: "LICENSE",
        content: body,
      });
    }
  }
  if (options.initReadme) {
    await invoke("write_repo_file", {
      repoPath,
      filePath: "README.md",
      content: buildReadmeContent(options.name, options.description),
    });
  }
}

export async function ensureInitialCommit(repoPath: string, message = "Initial commit"): Promise<void> {
  const hasCommits = await invoke<boolean>("repo_has_commits", { repoPath });
  if (hasCommits) return;
  await invoke("stage_all", { repoPath });
  await invoke("create_commit", { repoPath, message, sign: null });
}

export async function connectAndPushToGitHub(
  repoPath: string,
  ownerLogin: string,
  userLogin: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<CreatedRepoResult> {
  const created = await createGitHubRepository({
    ownerLogin,
    userLogin,
    name,
    description,
    isPrivate,
  });
  await invoke("add_remote", {
    repoPath,
    name: "origin",
    url: created.clone_url,
  });
  const pushResult = await invoke<{ ok: boolean; message: string }>("push_remote", {
    repoPath,
    force: null,
  });
  if (!pushResult.ok) {
    throw new Error(pushResult.message);
  }
  return { created, repoPath };
}

export interface CreatedRepoResult {
  created: Awaited<ReturnType<typeof createGitHubRepository>>;
  repoPath: string;
}

export async function createLocalAndPublishOnGitHub(
  options: CreateRepoOptions
): Promise<CreatedRepoResult> {
  const nameErr = validateRepoName(options.name);
  if (nameErr) throw new Error(nameErr);

  const localPath = options.localPath.trim();
  if (!localPath) throw new Error("Local path is required.");

  const isGit = await invoke<boolean>("is_git_repo", { path: localPath });
  if (isGit) throw new Error("This folder is already a Git repository.");

  const empty = await invoke<boolean>("path_is_empty_dir", { path: localPath });
  if (!empty) {
    throw new Error("Choose an empty folder or a new path that does not exist yet.");
  }

  await invoke("init_repo", { path: localPath });
  await bootstrapLocalRepoFiles(localPath, options);
  await ensureInitialCommit(localPath);

  return connectAndPushToGitHub(
    localPath,
    options.ownerLogin,
    options.userLogin,
    options.name.trim(),
    options.description,
    options.isPrivate
  );
}

export async function publishExistingRepoToGitHub(
  options: PublishRepoOptions
): Promise<CreatedRepoResult> {
  const nameErr = validateRepoName(options.name);
  if (nameErr) throw new Error(nameErr);

  const repoPath = options.repoPath.trim();
  const remotes = await invoke<{ name: string; url: string }[]>("get_remotes", { repoPath });
  if (remotes.some((r) => r.name === "origin")) {
    throw new Error('Remote "origin" already exists. Edit it in Repository settings or remove it first.');
  }

  const hasCommits = await invoke<boolean>("repo_has_commits", { repoPath });
  if (!hasCommits) {
    await invoke("stage_all", { repoPath });
    await invoke("create_commit", {
      repoPath,
      message: options.commitMessage ?? "Initial commit",
      sign: null,
    });
  }

  return connectAndPushToGitHub(
    repoPath,
    options.ownerLogin,
    options.userLogin,
    options.name.trim(),
    options.description,
    options.isPrivate
  );
}

export function resolveCreateLocalPath(parentPath: string, repoName: string): string {
  const nameErr = validateRepoName(repoName);
  if (nameErr) throw new Error(nameErr);
  if (!parentPath.trim()) throw new Error("Choose a parent folder.");
  const sep = parentPath.includes("\\") ? "\\" : "/";
  const base = parentPath.replace(/[/\\]+$/, "");
  return `${base}${sep}${repoName.trim()}`;
}
