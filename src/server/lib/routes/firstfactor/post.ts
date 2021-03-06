
import exceptions = require("../../Exceptions");
import objectPath = require("object-path");
import BluebirdPromise = require("bluebird");
import express = require("express");
import { AccessController } from "../../access_control/AccessController";
import { AuthenticationRegulator } from "../../AuthenticationRegulator";
import { Client, Attributes } from "../../ldap/Client";
import Endpoint = require("../../../endpoints");
import ErrorReplies = require("../../ErrorReplies");
import ServerVariables = require("../../ServerVariables");
import AuthenticationSession = require("../../AuthenticationSession");

export default function (req: express.Request, res: express.Response): BluebirdPromise<void> {
    const username: string = req.body.username;
    const password: string = req.body.password;

    const logger = ServerVariables.getLogger(req.app);
    const ldap = ServerVariables.getLdapAuthenticator(req.app);
    const config = ServerVariables.getConfiguration(req.app);

    if (!username || !password) {
        const err = new Error("No username or password");
        ErrorReplies.replyWithError401(res, logger)(err);
        return BluebirdPromise.reject(err);
    }

    const regulator = ServerVariables.getAuthenticationRegulator(req.app);
    const accessController = ServerVariables.getAccessController(req.app);
    const authSession = AuthenticationSession.get(req);

    logger.info("1st factor: Starting authentication of user \"%s\"", username);
    logger.debug("1st factor: Start bind operation against LDAP");
    logger.debug("1st factor: username=%s", username);

    return regulator.regulate(username)
        .then(function () {
            logger.info("1st factor: No regulation applied.");
            return ldap.authenticate(username, password);
        })
        .then(function (attributes: Attributes) {
            logger.info("1st factor: LDAP binding successful. Retrieved information about user are %s", JSON.stringify(attributes));
            authSession.userid = username;
            authSession.first_factor = true;

            const emails: string[] = attributes.emails;
            const groups: string[] = attributes.groups;

            if (!emails || emails.length <= 0) {
                const errMessage = "No emails found. The user should have at least one email address to reset password.";
                logger.error("1s factor: %s", errMessage);
                return BluebirdPromise.reject(new Error(errMessage));
            }

            authSession.email = emails[0];
            authSession.groups = groups;

            logger.debug("1st factor: Mark successful authentication to regulator.");
            regulator.mark(username, true);

            logger.debug("1st factor: Redirect to  %s", Endpoint.SECOND_FACTOR_GET);
            res.redirect(Endpoint.SECOND_FACTOR_GET);
            return BluebirdPromise.resolve();
        })
        .catch(exceptions.LdapSearchError, ErrorReplies.replyWithError500(res, logger))
        .catch(exceptions.LdapBindError, function (err: Error) {
            regulator.mark(username, false);
            return ErrorReplies.replyWithError401(res, logger)(err);
        })
        .catch(exceptions.AuthenticationRegulationError, ErrorReplies.replyWithError403(res, logger))
        .catch(exceptions.DomainAccessDenied, ErrorReplies.replyWithError401(res, logger))
        .catch(ErrorReplies.replyWithError500(res, logger));
}
