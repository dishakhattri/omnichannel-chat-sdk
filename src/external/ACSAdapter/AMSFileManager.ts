import FramedClient from "@microsoft/omnichannel-amsclient/lib/FramedClient";
import { ACSAdapterLogger } from "../../utils/loggers";

type FileMetadata = Record<string, string>;

enum FilePermission {
    READ,
    WRITE
}

interface IUploadedFile {
   fileId: string;
   metadata?: FileMetadata;
}

interface IAttachment {
    name: string;
    contentType: string;
    contentUrl: string;
    thumbnailUrl?: string;
}

interface IFileUploadRequest extends IAttachment {
    permissions?: PermissionsOptions;
}

interface PermissionsOptions {
    users: string[];
    permission: FilePermission;
}

enum AMSFileManagerEvent {
    AMSUpload = 'AMSUpload',
    AMSDownload = 'AMSDownload',
    GetFileIds = 'GetFileIds',
    CreateFileIdProperty = 'CreateFileIdProperty',
    GetFileMetadata = 'GetFileMetadata',
    CreateFileMetadataProperty = 'CreateFileMetadataProperty'
}

class AMSFileManager {
    private logger: ACSAdapterLogger | null;
    private amsClient: FramedClient;

    public constructor(amsClient: FramedClient, logger: ACSAdapterLogger | null = null) {
        this.logger = logger;
        this.amsClient = amsClient;
    }

    public async uploadFiles(files: IFileUploadRequest[]): Promise<IUploadedFile[]> {
        return Promise.all(files.map(async (file: IFileUploadRequest) => this.uploadFileToAMS(file))) as Promise<IUploadedFile[]>;
    }

    public async downloadFiles(files: IUploadedFile[]): Promise<File[]> {
        return Promise.all(files.map(async (file: IUploadedFile) => this.downloadFileFromAMS(file))) as Promise<File[]>;
    }

    public async updatePermissions(): Promise<void> {
        return undefined;
    }

    public getFileIds(metadata?: Record<string, string>): string[] | undefined {
        this.logger?.startScenario(AMSFileManagerEvent.GetFileIds);

        try {
            const result = JSON.parse(metadata?.amsReferences as string) as string[];
            this.logger?.completeScenario(AMSFileManagerEvent.GetFileIds);
            return result;
        } catch (error) {
            const exceptionDetails = {
                metadata: `${metadata}`,
                errorObject: `${error}`
            };

            this.logger?.failScenario(AMSFileManagerEvent.GetFileIds, {
                ExceptionDetails: JSON.stringify(exceptionDetails)
            });

            return undefined;
        }
    }

    public createFileIdProperty(fileIds: string[]): Record<string, string> | undefined {
        this.logger?.startScenario(AMSFileManagerEvent.CreateFileIdProperty);

        try {
            const result = {
                amsReferences: JSON.stringify(fileIds)
            } as Record<string, string>;
            this.logger?.completeScenario(AMSFileManagerEvent.CreateFileIdProperty);
            return result;
        } catch (error) {
            const exceptionDetails = {
                fileIds: `${fileIds}`,
                errorObject: `${error}`
            };

            this.logger?.failScenario(AMSFileManagerEvent.CreateFileIdProperty, {
                ExceptionDetails: JSON.stringify(exceptionDetails)
            });

            return undefined;
        }
    }

    public getFileMetadata(metadata?: Record<string, string>): FileMetadata[] | undefined {
        this.logger?.startScenario(AMSFileManagerEvent.GetFileMetadata);

        try {
            const result = JSON.parse(metadata?.amsMetadata as string);
            this.logger?.completeScenario(AMSFileManagerEvent.GetFileMetadata);
            return result;
        } catch (error) {
            const exceptionDetails = {
                metadata: `${metadata}`,
                errorObject: `${error}`
            };

            this.logger?.failScenario(AMSFileManagerEvent.GetFileMetadata, {
                ExceptionDetails: JSON.stringify(exceptionDetails)
            });

            return undefined;
        }
    }

    public createFileMetadataProperty(metadata: FileMetadata[]): Record<string, string> | undefined {
        this.logger?.startScenario(AMSFileManagerEvent.CreateFileMetadataProperty);

        try {
            const result = {
                amsMetadata: JSON.stringify(metadata)
            };
            this.logger?.completeScenario(AMSFileManagerEvent.CreateFileMetadataProperty);
            return result;
        } catch (error) {
            const exceptionDetails = {
                metadata: `${metadata}`,
                errorObject: `${error}`
            };

            this.logger?.failScenario(AMSFileManagerEvent.CreateFileMetadataProperty, {
                ExceptionDetails: JSON.stringify(exceptionDetails)
            });

            return undefined;
        }
    }

    private async uploadFileToAMS(fileToUpload: IFileUploadRequest): Promise<IUploadedFile | undefined> {
        this.logger?.startScenario(AMSFileManagerEvent.AMSUpload);

        if (fileToUpload.contentUrl && fileToUpload.name) {
            let blob;

            try {
                blob = await this.amsClient.fetchBlob(fileToUpload.contentUrl);
            } catch (error) {
                const exceptionDetails = {
                    response: 'AMSFetchBlobFailure',
                    errorObject: `${error}`
                };

                this.logger?.failScenario(AMSFileManagerEvent.AMSUpload, {
                    ExceptionDetails: JSON.stringify(exceptionDetails)
                });

                return undefined;
            }

            const file = new File([blob as Blob], fileToUpload.name, { type: fileToUpload.contentType });

            let response: any;  // eslint-disable-line @typescript-eslint/no-explicit-any
            try {
                response = await this.amsClient.createObject((this.amsClient as any).chatToken.chatId, file);  // eslint-disable-line @typescript-eslint/no-explicit-any
            } catch (error) {
                const exceptionDetails = {
                    response: 'AMSCreateObjectFailure',
                    errorObject: `${error}`
                };

                this.logger?.failScenario(AMSFileManagerEvent.AMSUpload, {
                    ExceptionDetails: JSON.stringify(exceptionDetails)
                });

                return undefined;
            }

            try {
                await this.amsClient.uploadDocument(response.id, file);
            } catch (error) {
                const exceptionDetails = {
                    response: 'AMSUploadDocumentFailure',
                    errorObject: `${error}`
                };

                this.logger?.failScenario(AMSFileManagerEvent.AMSUpload, {
                    ExceptionDetails: JSON.stringify(exceptionDetails)
                });

                return undefined;
            }

            this.logger?.completeScenario(AMSFileManagerEvent.AMSUpload);

            return {
                fileId: response.id,
                metadata: {
                    contentType: fileToUpload.contentType,
                    fileName: fileToUpload.name
                }
            }
        }
    }

    private async downloadFileFromAMS(uploadedFile: IUploadedFile): Promise<File | undefined> {
        this.logger?.startScenario(AMSFileManagerEvent.AMSDownload);

        if (uploadedFile.fileId && uploadedFile.metadata && uploadedFile.metadata.fileName) {
            const fileMetadata = {
                id: uploadedFile.fileId,
                type: uploadedFile.metadata.contentType.split("/").pop() as string
            };

            let response: any;  // eslint-disable-line @typescript-eslint/no-explicit-any

            try {
                response = await this.amsClient.getViewStatus(fileMetadata);  // eslint-disable-line @typescript-eslint/no-explicit-any
            } catch (error) {
                const exceptionDetails = {
                    response: 'AMSGetViewStatusFailure',
                    errorObject: `${error}`
                };

                this.logger?.failScenario(AMSFileManagerEvent.AMSDownload, {
                    ExceptionDetails: JSON.stringify(exceptionDetails)
                });

                return undefined;
            }

            const {view_location} = response;

            let blob: any;  // eslint-disable-line @typescript-eslint/no-explicit-any

            try {
                blob = await this.amsClient.getView(fileMetadata, view_location);  // eslint-disable-line @typescript-eslint/no-explicit-any
            } catch (error) {
                const exceptionDetails = {
                    response: 'AMSGetViewFailure',
                    errorObject: `${error}`
                };

                this.logger?.failScenario(AMSFileManagerEvent.AMSDownload, {
                    ExceptionDetails: JSON.stringify(exceptionDetails)
                });

                return undefined;
            }

            const file = new File([blob], uploadedFile.metadata.fileName, { type: uploadedFile.metadata.contentType });

            this.logger?.completeScenario(AMSFileManagerEvent.AMSDownload);

            return file;
        }
    }
}

export default AMSFileManager;