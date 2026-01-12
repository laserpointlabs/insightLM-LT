import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type GitStatus = {
  ok: boolean;
  repoRoot: string;
  isRepo: boolean;
  branch?: string;
  changes: Array<{ path: string; status: string }>;
  staged: Array<{ path: string; status: string }>;
  untracked: string[];
  error?: string;
};

export type GitLogEntry = {
  hash: string;
  subject: string;
  author: string;
  date: string;
};

function runGit(repoRoot: string, args: string[], stdin?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, {
      cwd: repoRoot,
      windowsHide: true,
      env: process.env,
    });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += String(d)));
    proc.stderr.on("data", (d) => (err += String(d)));
    proc.on("close", (code) => resolve({ code: typeof code === "number" ? code : 1, stdout: out, stderr: err }));
    if (stdin != null) {
      proc.stdin.write(String(stdin));
      proc.stdin.end();
    }
  });
}

export class GitService {
  constructor(private projectDataDir: string) {}

  getRepoRoot(): string {
    return path.resolve(String(this.projectDataDir || ""));
  }

  async init(): Promise<{ ok: boolean; repoRoot: string; error?: string }> {
    const repoRoot = this.getRepoRoot();
    try {
      if (!fs.existsSync(repoRoot)) fs.mkdirSync(repoRoot, { recursive: true });
      const res = await runGit(repoRoot, ["init"]);
      if (res.code !== 0) return { ok: false, repoRoot, error: res.stderr || res.stdout || "git init failed" };
      return { ok: true, repoRoot };
    } catch (e) {
      return { ok: false, repoRoot, error: e instanceof Error ? e.message : "git init failed" };
    }
  }

  async status(): Promise<GitStatus> {
    const repoRoot = this.getRepoRoot();
    // Use porcelain v2 for deterministic parsing.
    const res = await runGit(repoRoot, ["status", "--porcelain=v2", "--branch"]);
    if (res.code !== 0) {
      // Not a git repo typically exits non-zero; treat as isRepo=false.
      return {
        ok: false,
        repoRoot,
        isRepo: false,
        changes: [],
        staged: [],
        untracked: [],
        error: res.stderr || res.stdout || "git status failed",
      };
    }

    const changes: Array<{ path: string; status: string }> = [];
    const staged: Array<{ path: string; status: string }> = [];
    const untracked: string[] = [];
    let branch: string | undefined;

    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("# branch.head ")) {
        branch = line.replace("# branch.head ", "").trim();
        continue;
      }
      if (line.startsWith("? ")) {
        const p = line.slice(2).trim();
        if (p) untracked.push(p);
        continue;
      }
      // "1 XY ..." entries: https://git-scm.com/docs/git-status#_porcelain_format_version_2
      if (line.startsWith("1 ")) {
        const parts = line.split(" ");
        const xy = parts[1] || "";
        const p = parts[parts.length - 1] || "";
        const x = xy[0] || " ";
        const y = xy[1] || " ";
        if (x !== " ") staged.push({ path: p, status: x });
        if (y !== " ") changes.push({ path: p, status: y });
      }
    }

    return {
      ok: true,
      repoRoot,
      isRepo: true,
      branch,
      changes,
      staged,
      untracked,
    };
  }

  async diff(args?: { path?: string; staged?: boolean }): Promise<{ ok: boolean; diff: string; error?: string }> {
    const repoRoot = this.getRepoRoot();
    const a: string[] = ["diff"];
    if (args?.staged) a.push("--staged");
    if (args?.path) a.push("--", args.path);
    const res = await runGit(repoRoot, a);
    if (res.code !== 0) return { ok: false, diff: "", error: res.stderr || res.stdout || "git diff failed" };
    return { ok: true, diff: res.stdout };
  }

  async commit(message: string): Promise<{ ok: boolean; hash?: string; error?: string }> {
    const repoRoot = this.getRepoRoot();
    const msg = String(message || "").trim();
    if (!msg) return { ok: false, error: "Commit message required" };
    // MVP: stage all changes and commit.
    const add = await runGit(repoRoot, ["add", "-A"]);
    if (add.code !== 0) return { ok: false, error: add.stderr || add.stdout || "git add failed" };
    const res = await runGit(repoRoot, ["commit", "-m", msg]);
    if (res.code !== 0) return { ok: false, error: res.stderr || res.stdout || "git commit failed" };
    const head = await runGit(repoRoot, ["rev-parse", "HEAD"]);
    const hash = head.code === 0 ? head.stdout.trim() : undefined;
    return { ok: true, hash };
  }

  async log(limit: number = 20): Promise<{ ok: boolean; commits: GitLogEntry[]; error?: string }> {
    const repoRoot = this.getRepoRoot();
    const n = Math.max(1, Math.min(200, Number(limit) || 20));
    const format = "%H%x1f%an%x1f%ad%x1f%s";
    const res = await runGit(repoRoot, ["log", `-n${n}`, `--pretty=format:${format}`, "--date=iso"]);
    if (res.code !== 0) return { ok: false, commits: [], error: res.stderr || res.stdout || "git log failed" };
    const commits: GitLogEntry[] = res.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, subject] = line.split("\x1f");
        return { hash, author, date, subject };
      });
    return { ok: true, commits };
  }
}
