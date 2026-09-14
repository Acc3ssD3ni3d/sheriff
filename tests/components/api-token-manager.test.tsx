// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiTokenManager } from "@/components/api-token-manager";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

describe("API token manager", () => {
  it("renders the empty state after loading", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ data: [] })));
    render(<ApiTokenManager />);
    expect(await screen.findByText("No tokens yet.")).toBeTruthy();
  });

  it("submits scopes and shows plaintext only until acknowledged", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json({ data: [] }))
      .mockImplementationOnce(() => json({ data: {
        token: "shf_pat_public_private",
        id: "1",
      } }, 201))
      .mockImplementationOnce(() => json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ApiTokenManager />);
    await screen.findByText("No tokens yet.");
    await userEvent.type(screen.getByLabelText("Token name"), "Backup script");
    await userEvent.click(screen.getByRole("button", { name: "Generate token" }));
    expect(await screen.findByText("shf_pat_public_private")).toBeTruthy();
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      name: "Backup script",
      scopes: ["files:read", "files:write"],
      expiresInDays: 90,
    });
    await userEvent.click(screen.getByRole("button", { name: "I saved it" }));
    expect(screen.queryByText("shf_pat_public_private")).toBeNull();
  });

  it("requires confirmation before revoking an active token", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json({ data: [{
        id: "abc", name: "CLI", prefix: "shf_pat_123...", scopes: ["files:read"],
        expiresAt: null, lastUsedAt: null, revokedAt: null, createdAt: new Date().toISOString(),
      }] }))
      .mockImplementationOnce(() => json({ data: { id: "abc", revokedAt: new Date().toISOString() } }))
      .mockImplementationOnce(() => json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ApiTokenManager />);
    await screen.findByText("CLI");
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/settings/tokens/abc",
      { method: "DELETE" },
    ]);
  });
});
