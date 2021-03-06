
import PasswordResetHandler from "../../../../../../src/server/lib/routes/password-reset/identity/PasswordResetHandler";
import PasswordUpdater = require("../../../../../../src/server/lib/ldap/PasswordUpdater");
import { ServerVariables }  from "../../../../../../src/server/lib/ServerVariables";
import sinon = require("sinon");
import winston = require("winston");
import assert = require("assert");
import BluebirdPromise = require("bluebird");

import ExpressMock = require("../../../mocks/express");
import { UserDataStore } from "../../../mocks/UserDataStore";
import ServerVariablesMock = require("../../../mocks/ServerVariablesMock");

describe("test reset password identity check", function () {
    let req: ExpressMock.RequestMock;
    let res: ExpressMock.ResponseMock;
    let userDataStore: UserDataStore;
    let configuration: any;
    let serverVariables: ServerVariables;

    beforeEach(function () {
        req = {
            query: {
                userid: "user"
            },
            app: {
                get: sinon.stub()
            },
            session: {
                auth_session: {
                    userid: "user",
                    email: "user@example.com",
                    first_factor: true,
                    second_factor: false
                }
            },
            headers: {
                host: "localhost"
            }
        };

        const options = {
            inMemoryOnly: true
        };

        serverVariables = ServerVariablesMock.mock(req.app);


        userDataStore = UserDataStore();
        userDataStore.set_u2f_meta.returns(BluebirdPromise.resolve({}));
        userDataStore.get_u2f_meta.returns(BluebirdPromise.resolve({}));
        userDataStore.issue_identity_check_token.returns(BluebirdPromise.resolve({}));
        userDataStore.consume_identity_check_token.returns(BluebirdPromise.resolve({}));
        serverVariables.userDataStore = userDataStore as any;


        configuration = {
            ldap: {
                base_dn: "dc=example,dc=com",
                user_name_attribute: "cn"
            }
        };

        serverVariables.logger = winston;
        serverVariables.config = configuration;
        serverVariables.ldapEmailsRetriever = {
            retrieve: sinon.stub()
        } as any;

        res = ExpressMock.ResponseMock();
    });

    describe("test reset password identity pre check", () => {
        it("should fail when no userid is provided", function () {
            req.query.userid = undefined;
            const handler = new PasswordResetHandler();
            return handler.preValidationInit(req as any)
                .then(function () { return BluebirdPromise.reject("It should fail"); })
                .catch(function (err: Error) {
                    return BluebirdPromise.resolve();
                });
        });

        it("should fail if ldap fail", function (done) {
            (serverVariables.ldapEmailsRetriever as any).retrieve.returns(BluebirdPromise.reject("Internal error"));
            new PasswordResetHandler().preValidationInit(req as any)
                .catch(function (err: Error) {
                    done();
                });
        });

        it("should perform a search in ldap to find email address", function (done) {
            configuration.ldap.user_name_attribute = "uid";
            (serverVariables.ldapEmailsRetriever as any).retrieve.returns(BluebirdPromise.resolve([]));
            new PasswordResetHandler().preValidationInit(req as any)
                .then(function () {
                    assert.equal("user", (serverVariables.ldapEmailsRetriever as any).retrieve.getCall(0).args[0]);
                    done();
                });
        });

        it("should returns identity when ldap replies", function (done) {
            (serverVariables.ldapEmailsRetriever as any).retrieve.returns(BluebirdPromise.resolve(["test@example.com"]));
            new PasswordResetHandler().preValidationInit(req as any)
                .then(function () {
                    done();
                });
        });
    });
});
