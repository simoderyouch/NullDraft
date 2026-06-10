declare module 'screenshot-desktop' {
    interface ScreenshotOptions {
        format?: 'png' | 'jpg';
        screen?: number | string;
        filename?: string;
    }

    function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    function screenshot(options: ScreenshotOptions & { filename: string }): Promise<string>;

    export = screenshot;
}
