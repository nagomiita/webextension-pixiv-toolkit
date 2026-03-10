<template>
  <div class="option-section">
    <span class="option-card-title">{{ tl('_eagle_settings') }}</span>

    <v-card>
      <v-list two-line>
        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ tl('_enable_eagle_import') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ tl('_enable_eagle_import_desc') }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-switch v-model="enableEagleImport"></v-switch>
          </v-list-tile-action>
        </v-list-tile>

        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ tl('_eagle_api_url') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ tl('_eagle_api_url_desc') }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action style="width: 320px;">
            <v-text-field
              v-model="eagleApiUrl"
              :error-messages="apiUrlErrors"
              @blur="saveApiUrl"
            ></v-text-field>
          </v-list-tile-action>
        </v-list-tile>

        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ tl('_eagle_connection_status') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ connectionStatusText }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-btn depressed @click="testConnection" :loading="testingConnection">
              {{ tl('_eagle_test_connection') }}
            </v-btn>
          </v-list-tile-action>
        </v-list-tile>

        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ tl('_eagle_base_folder') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ eagleBaseFolderName || tl('_not_set') }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action style="width: 320px;">
            <v-select
              :items="folderItems"
              item-text="text"
              item-value="value"
              v-model="eagleBaseFolderId"
              clearable
              :loading="loadingFolders"
              @change="saveBaseFolder"
            ></v-select>
          </v-list-tile-action>
        </v-list-tile>

        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ tl('_eagle_reload_folders') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ tl('_eagle_reload_folders_desc') }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-btn depressed @click="loadFolders" :loading="loadingFolders">
              {{ tl('_reload') }}
            </v-btn>
          </v-list-tile-action>
        </v-list-tile>

        <v-list-tile>
          <v-list-tile-content>
            <v-list-tile-title>{{ tl('_eagle_create_work_folder') }}</v-list-tile-title>
            <v-list-tile-sub-title>{{ tl('_eagle_create_work_folder_desc') }}</v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-switch v-model="eagleCreateWorkFolder"></v-switch>
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
    </v-card>
  </div>
</template>

<script>
import browser from '@/modules/Extension/browser';
import EagleApiClient from '@@/modules/EagleApiClient';

export default {
  data() {
    return {
      enableEagleImport: false,
      eagleApiUrl: EagleApiClient.DEFAULT_API_URL,
      eagleBaseFolderId: '',
      eagleBaseFolderName: '',
      eagleCreateWorkFolder: false,
      loadingFolders: false,
      testingConnection: false,
      folderItems: [],
      apiUrlErrors: [],
      connectionStatusText: '',
    };
  },

  watch: {
    enableEagleImport(val) {
      browser.storage.local.set({
        enableEagleImport: !!val
      });
    },

    eagleCreateWorkFolder(val) {
      browser.storage.local.set({
        eagleCreateWorkFolder: !!val
      });
    }
  },

  created() {
    this.enableEagleImport = !!this.browserItems.enableEagleImport;
    this.eagleApiUrl = this.browserItems.eagleApiUrl || EagleApiClient.DEFAULT_API_URL;
    this.eagleBaseFolderId = this.browserItems.eagleBaseFolderId || '';
    this.eagleBaseFolderName = this.browserItems.eagleBaseFolderName || '';
    this.eagleCreateWorkFolder = !!this.browserItems.eagleCreateWorkFolder;
    this.connectionStatusText = this.tl('_not_tested');
  },

  methods: {
    createClient() {
      return new EagleApiClient(this.eagleApiUrl);
    },

    saveApiUrl() {
      try {
        EagleApiClient.assertAllowedBaseUrl(this.eagleApiUrl);
        this.apiUrlErrors = [];
        this.eagleApiUrl = EagleApiClient.normalizeBaseUrl(this.eagleApiUrl);

        browser.storage.local.set({
          eagleApiUrl: this.eagleApiUrl
        });
      } catch (error) {
        this.apiUrlErrors = [this.tl('_eagle_api_url_invalid')];
        this.eagleApiUrl = this.browserItems.eagleApiUrl || EagleApiClient.DEFAULT_API_URL;
      }
    },

    async testConnection() {
      this.testingConnection = true;

      try {
        this.saveApiUrl();

        if (this.apiUrlErrors.length > 0) {
          return;
        }

        const response = await this.createClient().getApplicationInfo();
        const info = EagleApiClient.unwrapData(response) || {};
        const version = info.version ? ` v${info.version}` : '';
        this.connectionStatusText = `${this.tl('_eagle_connection_ok')}${version}`;
      } catch (error) {
        this.connectionStatusText = `${this.tl('_eagle_connection_failed')}: ${error.message}`;
      } finally {
        this.testingConnection = false;
      }
    },

    async loadFolders() {
      this.loadingFolders = true;

      try {
        this.saveApiUrl();

        if (this.apiUrlErrors.length > 0) {
          return;
        }

        const response = await this.createClient().listFolders();
        this.folderItems = EagleApiClient.flattenFolders(
          EagleApiClient.extractFolders(response)
        );

        if (this.eagleBaseFolderId) {
          this.saveBaseFolder(this.eagleBaseFolderId);
        }
      } catch (error) {
        this.connectionStatusText = `${this.tl('_eagle_connection_failed')}: ${error.message}`;
      } finally {
        this.loadingFolders = false;
      }
    },

    saveBaseFolder(folderId) {
      const item = this.folderItems.find(folder => folder.value === folderId);
      const folderName = item ? item.text : '';

      this.eagleBaseFolderId = folderId || '';
      this.eagleBaseFolderName = folderName;

      browser.storage.local.set({
        eagleBaseFolderId: this.eagleBaseFolderId,
        eagleBaseFolderName: this.eagleBaseFolderName
      });
    }
  }
};
</script>
