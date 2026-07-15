const BASH_COMPLETION = `# wtx bash completion
# Add to ~/.bashrc: eval "$(wtx completion bash)"
_wtx_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local commands="create destroy list status enter prune refresh run doctor sync open which diff log gc init stash rename completion"

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return
  fi

  case "$prev" in
    destroy|status|enter|refresh|sync|open|which|diff|log|stash|run)
      local branches
      branches=$(wtx list --json 2>/dev/null | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(r=>console.log(r.branch))}catch{}})" 2>/dev/null)
      COMPREPLY=($(compgen -W "$branches" -- "$cur"))
      ;;
    rename)
      local branches
      branches=$(wtx list --json 2>/dev/null | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(r=>console.log(r.branch))}catch{}})" 2>/dev/null)
      COMPREPLY=($(compgen -W "$branches" -- "$cur"))
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))
      ;;
  esac
}
complete -F _wtx_completions wtx
`;

const ZSH_COMPLETION = `# wtx zsh completion
# Add to ~/.zshrc: eval "$(wtx completion zsh)"
_wtx() {
  local -a commands
  commands=(
    'create:Create a sandbox and open a shell in it'
    'destroy:Remove a sandbox worktree'
    'list:List registered sandboxes'
    'status:Show sandbox state and dependency drift'
    'enter:Open a shell in an existing sandbox'
    'prune:Remove all sandboxes for this repository'
    'refresh:Re-link dependencies and shared config'
    'run:Run a command inside a sandbox'
    'doctor:Diagnose issues'
    'sync:Rebase or merge upstream changes'
    'open:Open a sandbox in your editor'
    'which:Print the sandbox directory path'
    'diff:Show changes relative to main'
    'log:Show commits not in main'
    'gc:Remove old sandboxes'
    'init:Create .sandboxrc.json'
    'stash:Stash or restore changes'
    'rename:Rename a sandbox branch'
    'completion:Output shell completion script'
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "\$words[2]" in
    destroy|status|enter|refresh|sync|open|which|diff|log|stash|rename|run)
      local -a branches
      branches=(\${(f)"$(wtx list --json 2>/dev/null | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(r=>console.log(r.branch))}catch{}})" 2>/dev/null)"})
      _describe 'branch' branches
      ;;
    completion)
      _values 'shell' bash zsh fish
      ;;
  esac
}
compdef _wtx wtx
`;

const FISH_COMPLETION = `# wtx fish completion
# Save to ~/.config/fish/completions/wtx.fish
set -l commands create destroy list status enter prune refresh run doctor sync open which diff log gc init stash rename completion

complete -c wtx -f

# Subcommands
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a create -d "Create a sandbox"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a destroy -d "Remove a sandbox"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a list -d "List sandboxes"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a status -d "Show sandbox state"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a enter -d "Open shell in sandbox"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a prune -d "Remove all sandboxes"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a refresh -d "Re-link dependencies"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a run -d "Run command in sandbox"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a doctor -d "Diagnose issues"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a sync -d "Sync with upstream"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a open -d "Open in editor"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a which -d "Print sandbox path"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a diff -d "Show changes vs main"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a log -d "Show sandbox commits"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a gc -d "Remove old sandboxes"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a init -d "Create .sandboxrc.json"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a stash -d "Stash changes"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a rename -d "Rename sandbox branch"
complete -c wtx -n "not __fish_seen_subcommand_from $commands" -a completion -d "Output completions"

# Branch completions for branch-taking commands
for cmd in destroy status enter refresh sync open which diff log stash rename run
  complete -c wtx -n "__fish_seen_subcommand_from $cmd" -a "(wtx list --json 2>/dev/null | node -e \"process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(r=>console.log(r.branch))}catch{}})\" 2>/dev/null)"
end

# completion subcommand
complete -c wtx -n "__fish_seen_subcommand_from completion" -a "bash zsh fish"
`;

export async function completionCommand(shell: string): Promise<void> {
  if (shell === "bash") {
    process.stdout.write(BASH_COMPLETION);
  } else if (shell === "zsh") {
    process.stdout.write(ZSH_COMPLETION);
  } else if (shell === "fish") {
    process.stdout.write(FISH_COMPLETION);
  } else {
    console.error(`Unsupported shell: "${shell}". Use bash, zsh, or fish.`);
    process.exitCode = 1;
  }
}
