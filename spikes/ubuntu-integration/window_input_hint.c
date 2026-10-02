/* T0.10 experiment only. Build: cc -Wall -Wextra -Werror ... -lX11 */
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <errno.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    if (argc != 3 || (strcmp(argv[2], "on") && strcmp(argv[2], "off"))) {
        fprintf(stderr, "usage: window-input-hint <own-window-id> on|off\n");
        return 2;
    }
    errno = 0;
    char *end = NULL;
    unsigned long window = strtoul(argv[1], &end, 0);
    if (errno || !window || window > UINT32_MAX || *end || argv[1][0] == '-') {
        fprintf(stderr, "invalid window id\n");
        return 2;
    }
    Display *display = XOpenDisplay(NULL);
    if (!display) {
        fprintf(stderr, "X display unavailable\n");
        return 1;
    }
    XWindowAttributes attributes;
    XGetWindowAttributes(display, window, &attributes);
    XWMHints *hints = XGetWMHints(display, window);
    if (!hints) hints = XAllocWMHints();
    if (!hints) {
        XCloseDisplay(display);
        return 1;
    }
    int enabled = strcmp(argv[2], "on") == 0;
    hints->flags |= InputHint;
    hints->input = enabled;
    XSetWMHints(display, window, hints);
    XFree(hints);

    /* InputHint=False alone still allows WM_TAKE_FOCUS. Preserve every other
       protocol, including WM_DELETE_WINDOW, and opt back in for interaction. */
    Atom take_focus = XInternAtom(display, "WM_TAKE_FOCUS", False);
    Atom *protocols = NULL;
    int count = 0;
    XGetWMProtocols(display, window, &protocols, &count);
    Atom *updated = calloc((size_t)count + 1, sizeof(Atom));
    if (!updated) {
        if (protocols) XFree(protocols);
        XCloseDisplay(display);
        return 1;
    }
    int length = 0;
    for (int i = 0; i < count; i++) {
        if (protocols[i] != take_focus) updated[length++] = protocols[i];
    }
    if (enabled) updated[length++] = take_focus;
    XSetWMProtocols(display, window, updated, length);
    free(updated);
    if (protocols) XFree(protocols);
    XSync(display, False);
    printf("{\"inputHint\":%s,\"takeFocus\":%s,\"overrideRedirect\":%s}\n",
           enabled ? "true" : "false", enabled ? "true" : "false",
           attributes.override_redirect ? "true" : "false");
    XCloseDisplay(display);
    return 0;
}
