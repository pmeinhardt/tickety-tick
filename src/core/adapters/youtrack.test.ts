/**
 * @jest-environment node
 */

import { JSDOM } from "jsdom";

import client from "../client";
import scan from "./youtrack";

jest.mock("../client");

describe("youtrack adapter", () => {
  const html = "<html><body><yt-page-loader></yt-page-loader></body></html>";

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const url = (str: string) => new URL(str);

  const api = { get: jest.fn() };

  const options = {
    searchParams: {
      fields: "idReadable,summary,description,fields(name,value(name))",
    },
  };

  beforeEach(() => {
    api.get.mockReturnValue({ json: () => ({}) });
    (client as jest.Mock).mockReturnValue(api);
  });

  afterEach(() => {
    (client as jest.Mock).mockReset();
    api.get.mockReset();
  });

  it("returns an empty array if it is on a different page", async () => {
    const result = await scan(url("https://bitcrowd.youtrack.cloud/"), doc);
    expect(result).toEqual([]);
  });

  it("extracts tickets from issue pages", async () => {
    api.get.mockReturnValue({
      json: () => ({
        idReadable: "TT-0",
        summary: "Test issue page",
      }),
    });

    const result = await scan(
      url("https://bitcrowd.youtrack.cloud/issue/TT-0"),
      doc,
    );

    expect(api.get).toHaveBeenCalledWith("issues/TT-0", options);

    expect(result).toEqual([
      {
        id: "TT-0",
        title: "Test issue page",
        url: "https://bitcrowd.youtrack.cloud/issue/TT-0",
      },
    ]);
  });

  it("extracts tickets from issue pages (with slug)", async () => {
    api.get.mockReturnValue({
      json: () => ({
        idReadable: "TT-1",
        summary: "Test issue page with slug",
      }),
    });

    const result = await scan(
      url("https://bitcrowd.youtrack.cloud/issue/TT-1/Support-YouTrack"),
      doc,
    );

    expect(api.get).toHaveBeenCalledWith("issues/TT-1", options);

    expect(result).toEqual([
      {
        id: "TT-1",
        title: "Test issue page with slug",
        url: "https://bitcrowd.youtrack.cloud/issue/TT-1",
      },
    ]);
  });

  it("extracts tickets from agile board pages (current)", async () => {
    api.get.mockReturnValue({
      json: () => ({
        idReadable: "TT-2",
        summary: "Test agile board page",
      }),
    });

    const result = await scan(
      url("https://bitcrowd.youtrack.cloud/agiles/1-234/current?issue=TT-2"),
      doc,
    );

    expect(api.get).toHaveBeenCalledWith("issues/TT-2", options);

    expect(result).toEqual([
      {
        id: "TT-2",
        title: "Test agile board page",
        url: "https://bitcrowd.youtrack.cloud/issue/TT-2",
      },
    ]);
  });

  it("extracts tickets from agile board pages (with sprint ID)", async () => {
    api.get.mockReturnValue({
      json: () => ({
        idReadable: "TT-3",
        summary: "Test agile board page with sprint ID",
      }),
    });

    const result = await scan(
      url("https://bitcrowd.youtrack.cloud/agiles/1-234/5-678?issue=TT-3"),
      doc,
    );

    expect(api.get).toHaveBeenCalledWith("issues/TT-3", options);

    expect(result).toEqual([
      {
        id: "TT-3",
        title: "Test agile board page with sprint ID",
        url: "https://bitcrowd.youtrack.cloud/issue/TT-3",
      },
    ]);
  });

  it("recognizes issue description if available", async () => {
    api.get.mockReturnValue({
      json: () => ({
        idReadable: "TT-4",
        summary: "Test description",
        description: "Mark**down** description",
      }),
    });

    const result = await scan(
      url("https://bitcrowd.youtrack.cloud/issue/TT-4"),
      doc,
    );

    expect(api.get).toHaveBeenCalledWith("issues/TT-4", options);

    expect(result).toEqual([
      {
        id: "TT-4",
        title: "Test description",
        description: "Mark**down** description",
        url: "https://bitcrowd.youtrack.cloud/issue/TT-4",
      },
    ]);
  });

  it("recognizes issues types", async () => {
    api.get.mockReturnValue({
      json: () => ({
        idReadable: "TT-5",
        summary: "Test type",
        fields: [{ name: "Type", value: { name: "Task" } }],
      }),
    });

    const result = await scan(
      url("https://bitcrowd.youtrack.cloud/issue/TT-5"),
      doc,
    );

    expect(api.get).toHaveBeenCalledWith("issues/TT-5", options);

    expect(result).toEqual([
      {
        id: "TT-5",
        title: "Test type",
        type: "task",
        url: "https://bitcrowd.youtrack.cloud/issue/TT-5",
      },
    ]);
  });
});
