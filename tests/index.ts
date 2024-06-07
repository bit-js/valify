import type { Schema } from '../src/types/schema';

const matcher = new Bun.Glob('*.json');

export interface Test {
    description: string;
    data: any;
    valid: boolean;
}

export interface Suite {
    description: string;
    schema: Schema;
    tests: Test[];
}

function getDefault(o: any) {
    return o.default;
}

export default async function loadSuites(draft: string): Promise<Record<string, Suite[]>> {
    const suites: Record<string, any> = {};
    const rootPath = `${import.meta.dir}/suites/tests/${draft}`;

    // eslint-disable-next-line
    for (const path of matcher.scanSync(rootPath)) suites[path.slice(0, -5)] = await import(`${rootPath}/${path}`).then(getDefault);

    return suites;
}
