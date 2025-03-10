/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { UiStateStorage, UiStateStorageResult, UiStateStorageStatus } from "@itwin/appui-react";

/** UI settings storage that is persisted in working memory. Resets after page refresh. */
export class MemoryUISettingsStorage implements UiStateStorage {
  private settings = new Map<string, Map<string, unknown>>();

  public async getSetting(settingNamespace: string, settingName: string): Promise<UiStateStorageResult> {
    const setting = this.settings.get(settingNamespace)?.get(settingName);
    return { status: setting !== undefined ? UiStateStorageStatus.Success : UiStateStorageStatus.NotFound, setting };
  }

  public async saveSetting(settingNamespace: string, settingName: string, setting: any): Promise<UiStateStorageResult> {
    const scopedSettings = this.settings.get(settingNamespace) ?? new Map<string, unknown>();
    scopedSettings.set(settingName, setting);
    this.settings.set(settingNamespace, scopedSettings);
    return { status: UiStateStorageStatus.Success };
  }

  public async deleteSetting(settingNamespace: string, settingName: string): Promise<UiStateStorageResult> {
    const deleted = !!this.settings.get(settingNamespace)?.delete(settingName);
    return { status: deleted ? UiStateStorageStatus.Success : UiStateStorageStatus.NotFound };
  }
}
