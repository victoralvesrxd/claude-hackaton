import { Project, SourceFile, ScriptTarget } from 'ts-morph';

export function parseSource(code: string, filename = 'test.ts'): SourceFile {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2022,
    },
  });
  return project.createSourceFile(filename, code);
}

export function parseSources(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2022,
    },
  });
  for (const [name, code] of Object.entries(files)) {
    project.createSourceFile(name, code);
  }
  return project;
}
