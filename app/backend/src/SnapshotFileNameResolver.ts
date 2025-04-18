/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { IModelHost } from "@itwin/core-backend";

export class SnapshotFileNameResolver {
  public static getIModelsDirectory(): string {
    const assetsDir = IModelHost.appAssetsDir ? IModelHost.appAssetsDir : "assets";
    return path.resolve(path.join(assetsDir, "imodels"));
  }
}
