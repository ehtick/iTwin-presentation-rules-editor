/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UserManager } from "oidc-client";
import * as React from "react";
import { rpcInterfaces } from "@app/common";
import { BeEvent, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelApp, WebViewerApp } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";
import { PresentationUnitSystem } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import {
  AppNotificationManager, ConfigurableUiManager, FrameworkReducer, StateManager, UiFramework,
} from "@bentley/ui-framework";
import { AuthorizationState, useAuthorization } from "../Authorization";
import { LoadingIndicator } from "../utils/LoadingIndicator";
import { BackendApi } from "./api/BackendApi";
import { IModelIdentifier } from "./IModelIdentifier";
import { InitializedApp } from "./InitializedApp";

export interface ITwinJsAppProps {
  backendApiPromise: Promise<BackendApi>;
  imodelIdentifier: IModelIdentifier;
}

export function ITwinJsApp(props: ITwinJsAppProps): React.ReactElement {
  const [backendApi, setBackendApi] = React.useState<BackendApi>();
  const { state } = useAuthorization();

  React.useEffect(
    () => {
      let disposed = false;
      void (async () => {
        const loadedBackendApi = await props.backendApiPromise;
        if (!disposed) {
          setBackendApi(loadedBackendApi);
        }
      })();

      return () => { disposed = true; };
    },
    [props.backendApiPromise],
  );

  if (backendApi === undefined || state === AuthorizationState.Pending) {
    return <LoadingIndicator>Initializing...</LoadingIndicator>;
  }

  return <InitializedApp backendApi={backendApi} imodelIdentifier={props.imodelIdentifier} />;
}

export async function initializeApp(userManager: UserManager): Promise<BackendApi> {
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);

  const authClient = new AuthClient(userManager);
  await WebViewerApp.startup({
    iModelApp: {
      rpcInterfaces,
      notifications: new AppNotificationManager(),
      authorizationClient: authClient,
      i18n: {
        // Default template lacks the leading forward slash, which results in relative urls being requested
        urlTemplate: "/locales/{{lng}}/{{ns}}.json",
      },
    },
    webViewerApp: {
      rpcParams: { info: { title: "presentation-rules-editor", version: "v1.0" }, uriPrefix: "http://localhost:3001" },
    },
  });

  const backendApi = new BackendApi();
  await Promise.all([
    IModelApp.i18n.registerNamespace("App").readFinished,
    initializePresentation(backendApi),
    initializeUIFramework(),
  ]);

  // authorizationClient cannot be in authorized state before the app is initialized. Otherwise, we get Error:
  // UiFramework not initialized
  authClient.onAppInitialized();
  return backendApi;
}

async function initializePresentation(appFrontend: BackendApi): Promise<void> {
  await Presentation.initialize({
    clientId: appFrontend.getClientId(),
    activeLocale: "en",
    activeUnitSystem: PresentationUnitSystem.Metric,
  });

  Presentation.selection.scopes.activeScope = "top-assembly";
}

async function initializeUIFramework(): Promise<void> {
  await UiFramework.initialize(undefined, IModelApp.i18n);
  new StateManager({ frameworkState: FrameworkReducer });
  ConfigurableUiManager.initialize();
}

/** Forwards OAuth access token to IModelApp. */
class AuthClient implements FrontendAuthorizationClient {
  private initialized = false;
  private accessToken: AccessToken | undefined;

  constructor(private userManager: UserManager) {
    userManager.events.addUserLoaded((user) => {
      this.accessToken = AccessToken.fromTokenResponseJson(user, user.profile);
      if (this.initialized) {
        this.isAuthorized = true;
        this.hasSignedIn = true;
        this.onUserStateChanged.raiseEvent(this.accessToken);
      }
    });
  }

  public isAuthorized = false;

  public async getAccessToken(): Promise<AccessToken> {
    if (!this.initialized) {
      return new AccessToken();
    }

    if (this.accessToken === undefined) {
      const user = await this.userManager.getUser();
      if (user === null) {
        return new AccessToken();
      }

      this.accessToken = AccessToken.fromTokenResponseJson(user, user.profile);
    }

    return this.accessToken;
  }

  public async signIn(): Promise<void> { }

  public async signOut(): Promise<void> { }

  public onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  public hasSignedIn = false;

  public onAppInitialized() {
    this.initialized = true;
    if (this.accessToken !== undefined) {
      this.isAuthorized = true;
      this.hasSignedIn = true;
      this.onUserStateChanged.raiseEvent(this.accessToken);
    }
  }
}