import { createContext } from 'react';
/**
 * `StdoutContext` is a React context, which exposes stdout stream, where Ink renders your app.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const StdoutContext = createContext({
    stdout: undefined,
    write() { }
});
StdoutContext.displayName = 'InternalStdoutContext';
export default StdoutContext;
//# sourceMappingURL=StdoutContext.js.map